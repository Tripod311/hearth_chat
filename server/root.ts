import { Node, Dispatcher, Address, Event } from "@tripod311/dispatch"

import DB from "./db.js"
import API from "./api.js"
import Access from "./access.js"
import Gate from "./gate.js"
import InviteManager from "./inviteManager.js"
import TopicManager from "./topic/topicManager.js"

export default class Root extends Node {
	private db: DB;
	private api: API;
	private access: Access;
	private gate: Gate;
	private invites: InviteManager;
	private topicManager: TopicManager;

	constructor () {
		super();

		this.db = new DB();
		this.api = new API(this.db.httpPort, this.db.uuid);
		this.access = new Access();
		this.gate = new Gate(this.db.uuid, this.db.gatePort);
		this.invites = new InviteManager();
		this.topicManager = new TopicManager();
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.addChild("db", this.db);
		this.addChild("api", this.api);
		this.addChild("access", this.access);
		this.addChild("gate", this.gate);
		this.addChild("invites", this.invites);
		this.addChild("topics", this.topicManager);
	}
}