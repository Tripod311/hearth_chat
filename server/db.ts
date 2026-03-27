import crypto from "crypto"
import bcrypt from "bcrypt"
import FS from "fs"
import Database from "better-sqlite3"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

import addUser from "./db/user/addUser.js"
import editUser from "./db/user/editUser.js"
import deleteUser from "./db/user/deleteUser.js"
import authUser from "./db/user/authUser.js"
import getUsers from "./db/user/getUsers.js"
import setPassword from "./db/user/setPassword.js"
import getDisplayName from "./db/user/getDisplayName.js"
import setDisplayName from "./db/user/setDisplayName.js"

import allTopics from "./db/topics/allTopics.js"
import myTopics from "./db/topics/myTopics.js"
import createTopic from "./db/topics/createTopic.js"
import updateTopic from "./db/topics/updateTopic.js"
import deleteTopic from "./db/topics/deleteTopic.js"
import getTopicById from "./db/topics/getTopicById.js"
import pushMessage from "./db/topics/pushMessage.js"
import fetchMessages from "./db/topics/fetchMessages.js"
import authTopic from "./db/topics/authTopic.js"

import fetchTitle from "./db/node/fetchTitle.js"
import getNodeSettings from "./db/node/getNodeSettings.js"
import setNodeSettings from "./db/node/setNodeSettings.js"

import findActor from "./db/actor/findActor.js"

interface UserFilter {
	login?: string;
	is_admin?: number;
	is_bot?: number;
	last_login?: { anchor: number; less: boolean; };
}

export default class DB extends Node {
	private static readonly SCHEMA_VERSION = 0;
	private db: Database.Database;
	private node_id: string;
	private gate_port: number;
	private http_port: number;
	private announced_ip?: string | null;
	private ice_candidates?: string | null;

	constructor () {
		super();

		FS.mkdirSync("./data/files", { recursive: true });
		FS.mkdirSync("./data/tmp", { recursive: true });

		const doSetupRoutine = !FS.existsSync("./data/database.sqlite");

		this.db = new Database("./data/database.sqlite");
		this.db.pragma("foreign_keys = ON");
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("busy_timeout = 5000");
		this.db.pragma("user_version = 0");

		if (doSetupRoutine) {
			this.db.exec(`CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY,
				login VARCHAR(300) UNIQUE,
				password CHAR(60),

				is_admin INTEGER NOT NULL DEFAULT 0,
				is_bot INTEGER NOT NULL DEFAULT 0,
				last_login INTEGER,
				quick_files TEXT
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS actors (
				id INTEGER PRIMARY KEY,

				node_id TEXT,
				node_user_id INTEGER,
				display_name VARCHAR(300),
				is_banned INTEGER NOT NULL DEFAULT 0,

				FOREIGN KEY (node_id) REFERENCES related(uuid)
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS topics (
				id INTEGER PRIMARY KEY,
				creator_id INTEGER NOT NULL,

				title VARCHAR(300) NOT NULL,
				description TEXT,

				guest_access INTEGER DEFAULT 1,
				author_write_only INTEGER DEFAULT 0,
				password CHAR(60),

				FOREIGN KEY (creator_id) REFERENCES users(id)
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS settings (
				id INTEGER PRIMARY KEY CHECK (id=1),

				uuid TEXT,
				name VARCHAR(300),
				http_port INTEGER,
				gate_port INTEGER,
				description TEXT,
				title_page TEXT,
				ice_candidates TEXT,
				announced_ip TEXT
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS pending_related (
				id INTEGER PRIMARY KEY,

				url TEXT,
				uuid TEXT,
				message TEXT
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS related (
				id INTEGER PRIMARY KEY,

				uuid TEXT NOT NULL UNIQUE,
				url TEXT NOT NULL UNIQUE,
				title VARCHAR(300),
				description TEXT,

				direct INTEGER DEFAULT 0,
				is_visible INTEGER NOT NULL DEFAULT 1,
				is_alive INTEGER NOT NULL DEFAULT 0
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY,
				topic_id INTEGER NOT NULL,

				actor_id INTEGER NOT NULL,
				content TEXT,

				created_at INTEGER NOT NULL,

				FOREIGN KEY (topic_id) REFERENCES topics(id)
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS attachments (
				id INTEGER PRIMARY KEY,
				message_id INTEGER NOT NULL,
				file_path TEXT NOT NULL UNIQUE,
				
				FOREIGN KEY (message_id) REFERENCES messages(id)
			);`);

			this.db.exec(`CREATE INDEX IF NOT EXISTS idx_message_topic_id ON messages(topic_id, id)`);
			this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_topic_created ON messages(topic_id, created_at);`);
			this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_actor_id ON messages(topic_id, actor_id);`);

			const nodeId = crypto.randomUUID();

			this.db.prepare(`INSERT INTO settings (uuid, http_port, gate_port, name, description, title_page) VALUES (
					?,
					8080,
					14567,
					'HearthChat Node',
					'Fresh node',
					'[]'
			);`).run([nodeId]);
			this.createRootUser();

			this.node_id = nodeId;
			this.gate_port = 14567;
			this.http_port = 8080;
		} else {
			const row = this.db.prepare("SELECT uuid, http_port, gate_port, announced_ip, ice_candidates FROM settings WHERE id=1").get() as { uuid: string; gate_port: number; http_port: number; announced_ip: string | null; ice_candidates: string | null };

			this.node_id = row.uuid;
			this.gate_port = row.gate_port;
			this.http_port = row.http_port;
			this.announced_ip = row.announced_ip;
			this.ice_candidates = row.ice_candidates;
		}

		Log.success("Database initialized", 0)
	}

	async createRootUser () {
		const login = "root";
		const password = "root";

		const hash = await bcrypt.hash(password, 10);

		const info = this.db.prepare(`INSERT INTO users (login, password, is_admin, last_login) VALUES (?, ?, 1, ?)`).run([login, hash, Math.floor(Date.now() / 1000)]);
		this.db.prepare(`INSERT INTO actors (node_user_id, display_name) VALUES (?, ?)`).run([info.lastInsertRowid, login]);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("addUser", addUser.bind(this, this.db));
		this.setListener("editUser", editUser.bind(this, this.db));
		this.setListener("deleteUser", deleteUser.bind(this, this.db));
		this.setListener("authUser", authUser.bind(this, this.db));
		this.setListener("getUsers", getUsers.bind(this, this.db));
		this.setListener("setPassword", setPassword.bind(this, this.db));
		this.setListener("getDisplayName", getDisplayName.bind(this, this.db));
		this.setListener("setDisplayName", setDisplayName.bind(this, this.db));

		this.setListener("getAllTopics", allTopics.bind(this, this.db));
		this.setListener("getUserTopics", myTopics.bind(this, this.db));
		this.setListener("createTopic", createTopic.bind(this, this.db));
		this.setListener("updateTopic", updateTopic.bind(this, this.db));
		this.setListener("deleteTopic", deleteTopic.bind(this, this.db));
		this.setListener("getTopicById", getTopicById.bind(this, this.db));
		this.setListener("authTopic", authTopic.bind(this, this.db));

		this.setListener("fetchTitle", fetchTitle.bind(this, this.db));
		this.setListener("getNodeSettings", getNodeSettings.bind(this, this.db));
		this.setListener("setNodeSettings", setNodeSettings.bind(this, this.db));

		this.setListener("findActor", findActor.bind(this, this.db));

		this.setListener("pushMessage", pushMessage.bind(this, this.db));
		this.setListener("fetchMessages", fetchMessages.bind(this, this.db));

		this.setListener("checkAssigned", this.checkAssigned.bind(this));
	}

	detach () {
		this.db.close();

		super.detach();
	}

	get uuid () {
		return this.node_id;
	}

	get gatePort () {
		return this.gate_port;
	}

	get httpPort () {
		return this.http_port;
	}

	get mediasoupParams (): { announced_ip?: string; ice_candidates?: string; } {
		return {
			announced_ip: this.announced_ip || undefined,
			ice_candidates: this.ice_candidates || undefined
		}
	}

	checkAssigned (event: Event) {
		const files = new Set<string>(event.data.data.files);
		const placeholders = event.data.data.files.map(() => '?').join(',');

		const rows = this.db.prepare(`SELECT file_path FROM attachments WHERE file_path IN (${placeholders})`).all(event.data.data.files) as { file_path: string; }[];

		for (const row of rows) {
			files.delete(row.file_path);
		}

		event.response({
			command: "checkAssignedResponse",
			data: Array.from(files)
		});
	}
}