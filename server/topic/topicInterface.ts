import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import Actor from "./actor.js"

interface ChunkRequest {
	offset: number;
	replaceContent: boolean;
	chunk_size: number;
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

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		const dbAddress = this.address!.parent.parent.data;
		dbAddress.push("db");
		this.dbAddress = new Address(dbAddress);
	}

	detach () {
		for (const actor of this.actors) {
			actor.kill();
		}

		super.detach();
	}

	connectActor (actor: Actor) {
		this.actors.add(actor);

		if (!this.password_protected || actor.is_admin) actor.authorized = true;

		actor.on("disconnected", this.disconnectActor.bind(this, actor));
		actor.on("fetchMessages", this.fetchMessages.bind(this, actor));
		actor.on("pushMessage", this.pushMessage.bind(this, actor));

		actor.proxy(JSON.stringify({
			command: "setup",
			data: {
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
				}})
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
					offset: req.offset
				}
			}, (response: Event) => {
				if (response.data.error) {
					actor.proxy(JSON.stringify({
						command: "chunkError",
						data: {
							requestedOffset: req.offset,
							replaceContent: req.replaceContent,
							details: response.data.details
						}
					}));
				} else {
					actor.proxy(JSON.stringify({
						command: "chunkResponse",
						data: {
							requestedOffset: req.offset,
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
			this.send(this.dbAddress, {
				command: "pushMessage",
				data: {
					actor_id: actor.id,
					content: data.content,
					attachments: data.attachments
				}
			});
			this.notify(JSON.stringify({
				command: "message",
				data: {
					actor_id: actor.id,
					display_name: actor.display_name,
					content: data.content,
					attachments: data.attachments,
					created_at: (Date.now())/1000
				}
			}));
		} else {
			this.chain(this.dbAddress, {
				command: "authTopic",
				data: {
					topic_id: this.id,
					password: data.content
				}
			});
		}
	}

	notify (message: string) {
		for (const actor of this.actors) {
			actor.proxy(message);
		}
	}
}