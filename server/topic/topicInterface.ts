import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import Actor from "./actor.js"

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

		if (!this.password_protected) actor.authorized = true;

		actor.on("disconnected", this.disconnectActor.bind(this, actor));
		actor.on("fetchMessages", this.fetchMessages.bind(this, actor));
		actor.on("pushMessage", this.pushMessage.bind(this, actor));

		actor.proxy(JSON.stringify({
			command: "setup",
			data: {
				selfId: actor.id,
				title: this.title,
				description: this.description,
				password_protected: this.password_protected,
				author_write_only: this.author_write_only,
				can_write: this.author_write_only ? actor.is_admin || (actor.node_id === null && actor.node_user_id === this.author_id) : true
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

	fetchMessages (actor: Actor, ) {
		if (actor.authorized) {

		} else {

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
					content: data.content,
					attachments: data.attachments,
					created_at: (Date.now())/1000
				}
			}));
		} else {
			
		}
	}

	notify (message: string) {
		for (const actor of this.actors) {
			actor.proxy(message);
		}
	}
}