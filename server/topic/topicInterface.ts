import EventEmitter from "events"
import Actor from "./actor.js"

export default class TopicInterface extends EventEmitter {
	private actors: Set<Actor> = new Set();

	public title: string;
	public description: string;
	public guest_access: boolean;
	public password_protected: boolean;
	public author_write_only: boolean;
	public author_id: number;

	constructor (title: string, description: string, guest_access: boolean, password_protected: boolean, author_write_only: boolean, author_id: number) {
		super();
		
		this.title = title;
		this.description = description;
		this.guest_access = guest_access;
		this.password_protected = password_protected;
		this.author_write_only = author_write_only;
		this.author_id = author_id;
	}

	connectActor (actor: Actor) {
		this.actors.add(actor);

		if (!this.password_protected) actor.authorized = true;

		actor.on("disconnected", this.disconnectActor.bind(this, actor));
		actor.on("fetchMessages", this.fetchMessages.bind(this, actor));
		actor.on("pushMessage", this.pushMessage.bind(this, actor));

		actor.proxy(JSON.stringify({
			command: "setup",
			data: {/* setup data */}
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

	fetchMessages (actor: Actor) {
		if (actor.authorized) {

		} else {

		}
	}

	pushMessage (actor: Actor) {
		if (actor.authorized) {

		} else {
			
		}
	}

	notify (message: string) {
		for (const actor of this.actors) {
			actor.proxy(message);
		}
	}
}