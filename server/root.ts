import { Node, Dispatcher, Address, Event } from "@tripod311/dispatch"

import DB from "./db.js"
import API from "./api.js"
import Access from "./access.js"
import Gate from "./gate/gate.js"
import InviteManager from "./inviteManager.js"
import TopicManager from "./topic/topicManager.js"
import UploadsTracker from "./uploadsTracker.js"
import MediasoupController from "./mediasoupController.js"
import "./vapidKeys.js"

export default class Root extends Node {
	private db: DB;
	private api: API;
	private access: Access;
	private gate: Gate;
	private invites: InviteManager;
	private topicManager: TopicManager;
	private uploadsTracker: UploadsTracker;

	constructor () {
		super();

		this.db = new DB();
		this.api = new API(this.db.httpPort, this.db.uuid);
		this.access = new Access();
		this.gate = new Gate({
			uuid: this.db.uuid,
			title: this.db.title,
			description: this.db.description,
			port: this.db.gatePort,
			ip: ""
		});
		this.invites = new InviteManager();
		this.topicManager = new TopicManager();
		this.uploadsTracker = new UploadsTracker();
		console.log("Self id: " + this.db.uuid);

		MediasoupController.announced_ip = this.db.mediasoupParams.announced_ip;
		MediasoupController.ice_candidates = this.db.mediasoupParams.ice_candidates;
		MediasoupController.setup();
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.addChild("db", this.db);
		this.addChild("api", this.api);
		this.addChild("access", this.access);
		this.addChild("gate", this.gate);
		this.addChild("invites", this.invites);
		this.addChild("topics", this.topicManager);
		this.addChild("uploadsTracker", this.uploadsTracker);
	}

	detach () {
		this.uploadsTracker.forceCheck().then(() => {
			MediasoupController.shutdown().then(() => {
				super.detach();
			});
		})
	}
}