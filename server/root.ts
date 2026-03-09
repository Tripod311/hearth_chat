import FS from "fs"
import { Node, Dispatcher, Address, Event } from "@tripod311/dispatch"

import DB from "./db.js"
import API from "./api.js"
import Access from "./access.js"

let Config: ApplicationConfig;

try {
	Config = JSON.parse(FS.readFileSync("./config.json", "utf-8")) as ApplicationConfig;
} catch (err: any) {
	console.warn("config.json not found, using default settings and creating sample config file");
	Config = {
		http_port: 8080,
		http_certificates: {
			key: "path_to_key",
			cert: "path_to_cert",
			ca: "path_to_ca. this one is optional. If you don't have certificates, just delete whole http_certificates sections, but be ready that voice/video chats won't work."
		},
		tcp_gate: 14567
	}

	FS.writeFileSync("./config.json", JSON.stringify(Config, null, 4));
	delete Config.http_certificates;
}

export default class Root extends Node {
	private db: DB;
	private api: API;
	private access: Access;

	constructor () {
		super();

		this.db = new DB();
		this.api = new API(Config.http_port, Config.http_certificates, this.db.uuid);
		this.access = new Access();
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.addChild("db", this.db);
		this.addChild("api", this.api);
		this.addChild("access", this.access);
	}
}