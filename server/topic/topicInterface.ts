import mediasoup from "mediasoup"
import MediasoupController from "../mediasoupController.js"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import Actor from "./actor.js"

interface ChunkRequest {
	offset: number;
	direction: string;
	replaceContent: boolean;
	chunk_size: number;
}

interface ActorMediaState {
	connected: boolean;
	audio: boolean;
	video: boolean;
}

export default class TopicInterface extends Node {
	private actors: Set<Actor> = new Set();

	public id: number;
	public title: string;
	public description: string;
	public guest_access: boolean;
	public password_protected: boolean;
	public author_write_only: boolean;
	public author_id: number;

	private dbAddress!: Address;

	private router!: mediasoup.types.Router;
	private mediaState: Record<number, ActorMediaState> = {};
	private mediaStateTimeout?: ReturnType<typeof setTimeout>;

	constructor (id: number, title: string, description: string, guest_access: boolean, password_protected: boolean, author_write_only: boolean, author_id: number) {
		super();
		
		this.id = id;
		this.title = title;
		this.description = description;
		this.guest_access = guest_access;
		this.password_protected = password_protected;
		this.author_write_only = author_write_only;
		this.author_id = author_id;
	}

	async createRouter () {
		this.router = await MediasoupController.createRouter(this.id);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		const dbAddress = this.address!.parent.parent.data;
		dbAddress.push("db");
		this.dbAddress = new Address(dbAddress);
	}

	detach () {
		clearTimeout(this.mediaStateTimeout);

		for (const actor of this.actors) {
			actor.kill();
		}

		super.detach();
	}

	connectActor (actor: Actor) {
		this.actors.add(actor);

		if (!this.password_protected || actor.is_admin) actor.authorized = true;

		this.mediaState[actor.id] = {
			connected: false,
			audio: false,
			video: false
		}

		actor.on("disconnected", this.disconnectActor.bind(this, actor));
		actor.on("fetchMessages", this.fetchMessages.bind(this, actor));
		actor.on("pushMessage", this.pushMessage.bind(this, actor));
		actor.on("createConsumer", this.createConsumer.bind(this, actor));
		actor.on("mediaChange", this.updateMediaState.bind(this, actor));
		if (actor.kind === "ws" || actor.kind === "proxy") {
			actor.on("createTransport", this.createWebRtcTransport.bind(this, actor));
		}

		actor.proxy(JSON.stringify({
			command: "setup",
			data: {
				rtpCapabilities: this.router.rtpCapabilities,
				iceServers: MediasoupController.ice_candidates,
				topicInfo: {
					selfId: actor.id,
					title: this.title,
					description: this.description,
					password_protected: this.password_protected,
					authorized: actor.authorized,
					can_write: this.author_write_only ? actor.is_admin || (actor.node_id === null && actor.node_user_id === this.author_id) : true
				},
				actors: Array.from(this.actors).map(a => { return {
					id: a.id,
					display_name: a.display_name,
					is_admin: a.is_admin,
					is_bot: a.is_bot
				}}),
				mediaState: this.gatherMediaState()
			}
		}));

		this.notify(JSON.stringify({
			command: "actorConnected",
			data: actor.display_name
		}));
	}

	disconnectActor (actor: Actor) {
		this.actors.delete(actor);

		this.notify(JSON.stringify({
			command: "actorDisconnected",
			data: actor.display_name
		}));
	}

	fetchMessages (actor: Actor, req: ChunkRequest) {
		if (actor.authorized) {
			this.chain(this.dbAddress, {
				command: "fetchMessages",
				data: {
					topic_id: this.id,
					offset: req.offset,
					direction: req.direction,
					limit: req.chunk_size
				}
			}, (response: Event) => {
				if (response.data.error) {
					actor.proxy(JSON.stringify({
						command: "chunkError",
						data: {
							requestedOffset: req.offset,
							requestedDirection: req.direction,
							replaceContent: req.replaceContent,
							details: response.data.details
						}
					}));
				} else {
					actor.proxy(JSON.stringify({
						command: "chunkResponse",
						data: {
							requestedOffset: req.offset,
							requestedDirection: req.direction,
							replaceContent: req.replaceContent,
							messages: response.data.data
						}
					}));
				}
			});
		}
	}

	pushMessage (actor: Actor, data: { content: string; attachments: string; }) {
		if (actor.authorized) {
			const created_at = Math.floor((Date.now())/1000);

			this.chain(this.dbAddress, {
				command: "pushMessage",
				data: {
					topic_id: this.id,
					actor_id: actor.id,
					content: data.content,
					attachments: data.attachments,
					created_at: created_at
				}
			}, (response: Event) => {
				if (!response.data.error) {
					this.notify(JSON.stringify({
						command: "message",
						data: {
							id: response.data.data.id,
							actor_id: actor.id,
							display_name: actor.display_name,
							content: data.content,
							attachments: data.attachments,
							created_at: created_at
						}
					}));
				}
			});
		} else {
			this.chain(this.dbAddress, {
				command: "authTopic",
				data: {
					topic_id: this.id,
					password: data.content
				}
			}, (response: Event) => {
				
			});
		}
	}

	notify (message: string) {
		for (const actor of this.actors) {
			actor.proxy(message);
		}
	}

	async createWebRtcTransport (actor: Actor) {
		const sendTransport = await this.router.createWebRtcTransport({
			listenIps: [{ ip: "0.0.0.0", announcedIp: MediasoupController.announced_ip }],
			enableUdp: true,
			enableTcp: true,
			preferUdp: true
		});
		actor.setSendTransport(sendTransport);

		const recvTransport = await this.router.createWebRtcTransport({
			listenIps: [{ ip: "0.0.0.0", announcedIp: MediasoupController.announced_ip }],
			enableUdp: true,
			enableTcp: true,
			preferUdp: true
		});
		actor.setRecvTransport(recvTransport);
	}

	async createConsumer (actor: Actor, data: { actorId: number; kind: string }) {
		if (actor.transports === null) return;

		const transport = actor.transports.recv;

		const producerActor = Array.from(this.actors).find(a => a.id === data.actorId);

		if (!producerActor) return;

		const producer = data.kind === "audio" ? producerActor.audioProducer : producerActor.videoProducer;

		if (!producer) return;

		if (!this.router.canConsume({ producerId: producer.id, rtpCapabilities: this.router.rtpCapabilities })) return;

		const consumer = await transport.consume({
			producerId: producer.id,
			rtpCapabilities: this.router.rtpCapabilities,
			paused: true
		});

		actor.setConsumer(consumer.id, {
			consumer: consumer,
			producerId: producer.id,
			actorId: producerActor.id,
			kind: data.kind
		});
	}

	gatherMediaState (): Record<number, { display_name: string; audio: boolean; video: boolean; }> {
		const result: Record<number, { display_name: string; audio: boolean; video: boolean; }> = {};

		for (const actor of this.actors) {
			const id = actor.id;

			if (this.mediaState[id].connected) {
				result[id] = {
					display_name: actor.display_name,
					video: this.mediaState[id].video,
					audio: this.mediaState[id].audio
				};
			}
		}

		return result;
	}

	updateMediaState (actor: Actor, state: ActorMediaState) {
		clearTimeout(this.mediaStateTimeout);

		this.mediaState[actor.id] = state;

		this.mediaStateTimeout = setTimeout(() => {
			this.notify(JSON.stringify({
				command: "mediaUpdate",
				data: this.gatherMediaState()
			}));
		}, 1000);
	}
}