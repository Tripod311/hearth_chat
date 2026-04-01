import mediasoup from "mediasoup"
import MediasoupController from "../mediasoupController.js"
import webpush from "web-push"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import Actor from "./actor.js"
import TopicMedia from "./topicMedia.js"

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
	private media!: TopicMedia;
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
		this.media = new TopicMedia(this.router);
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

		MediasoupController.closeRouter(this.id);

		super.detach();
	}

	connectActor (actor: Actor) {
		this.actors.add(actor);
		actor.media = this.media;

		if (!this.password_protected || actor.is_admin) actor.authorized = true;

		actor.on("disconnected", this.disconnectActor.bind(this, actor));
		actor.on("fetchMessages", this.fetchMessages.bind(this, actor));
		actor.on("pushMessage", this.pushMessage.bind(this, actor));
		actor.on("mediaChange", this.updateMediaState.bind(this, actor));

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
			data: { id: actor.id, display_name: actor.display_name, is_admin: actor.is_admin, is_bot: actor.is_bot }
		}));
	}

	disconnectActor (actor: Actor) {
		actor.kill();

		this.actors.delete(actor);

		this.notify(JSON.stringify({
			command: "actorDisconnected",
			data: { id: actor.id }
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
		if (actor.authorized && (!this.author_write_only || actor.is_admin || (actor.node_id === null && actor.node_user_id === this.author_id))) {
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
					if (data.content.startsWith("@push")) {
						this.sendPush(actor.display_name, data.content);
					}

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
				if (!response.data.error) {
					actor.authorized = true;
					actor.proxy(JSON.stringify({
						command: "authorize"
					}));
				}
			});
		}
	}

	notify (message: string) {
		for (const actor of this.actors) {
			actor.proxy(message);
		}
	}

	gatherMediaState (): Record<number, { display_name: string; audio?: string; video?: string; }> {
		const result: Record<number, { display_name: string; audio?: string; video?: string; }> = {};

		for (const actor of this.actors) {
			const id = actor.id;
			const mediaState = actor.mediaState;

			if (mediaState !== undefined) result[id] = mediaState;
		}

		return result;
	}

	updateMediaState (actor: Actor, state: ActorMediaState) {
		clearTimeout(this.mediaStateTimeout);

		this.mediaStateTimeout = setTimeout(() => {
			this.notify(JSON.stringify({
				command: "mediaUpdate",
				data: this.gatherMediaState()
			}));
		}, 1000);
	}

	sendPush (display_name: string, content: string) {
		this.chain(this.dbAddress, {
			command: "fetchPushSubscriptions",
			data: {}
		}, async (response: Event) => {
			if (response.data.error) {
				Log.error(`FetchPushSubscriptions error: ${response.data.details}`, 0);
			} else {
				let toDelete: string[] = [];

				for (const subscription of response.data.data) {
					try {
						await webpush.sendNotification({
							endpoint: subscription.endpoint,
							keys: {
								p256dh: subscription.p256dh,
								auth: subscription.auth
							}
						}, JSON.stringify({
							title: `[${display_name} in ${this.title}]:${content.slice(5)}`
						}));
					} catch (err: any) {
						if (err.statusCode === 410) {
							toDelete.push(subscription.endpoint);
						} else {
							Log.warning(`Push notification error: ${err.toString()}`, 0);
						}
					}
				}

				if (toDelete.length > 0) {
					this.send(this.dbAddress, {
						command: "deletePushBulk",
						data: toDelete
					});
				}
			}
		});
	}
}