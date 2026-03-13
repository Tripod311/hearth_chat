import crypto from "crypto"
import FS from "fs"
import bcrypt from "bcrypt"
import Database from "better-sqlite3"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

export default class DB extends Node {
	private db: Database.Database;
	private node_id: string;
	private gate_port: number;
	private http_port: number;

	constructor () {
		super();

		FS.mkdirSync("./data/files", { recursive: true });

		const doSetupRoutine = !FS.existsSync("./data/database.sqlite");

		this.db = new Database("./data/database.sqlite");
		this.db.pragma("foreign_keys = ON");
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("busy_timeout = 5000");

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
				image_path TEXT,
				is_banned INTEGER NOT NULL DEFAULT 0,

				FOREIGN KEY (node_id) REFERENCES related(uuid)
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS topics (
				id INTEGER PRIMARY KEY,
				creator_id INTEGER NOT NULL,

				title VARCHAR(300) NOT NULL,
				description TEXT,
				image_path TEXT,

				storage_count INTEGER DEFAULT -1,
				is_temporary INTEGER DEFAULT 0,
				guest_access INTEGER DEFAULT 1,
				expires_at INTEGER,
				password CHAR(60),

				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,

				FOREIGN KEY (creator_id) REFERENCES users(id)
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS settings (
				id INTEGER PRIMARY KEY CHECK (id=1),

				uuid TEXT,
				name VARCHAR(300),
				http_port INTEGER,
				gate_port INTEGER,
				description TEXT,
				title_page TEXT
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
				is_alive INTEGER NOT NULL DEFAULT 0,
				created_at INTEGER NOT NULL
			);`);

			this.db.exec(`CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY,
				topic_id INTEGER NOT NULL,

				actor_id INTEGER NOT NULL,
				content TEXT,
				attachments TEXT,

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
			const row = this.db.prepare("SELECT uuid, http_port, gate_port FROM settings WHERE id=1").get() as { uuid: string; gate_port: number; http_port: number; };

			this.node_id = row.uuid;
			this.gate_port = row.gate_port;
			this.http_port = row.http_port;
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

		this.setListener("addActor", this.addActor.bind(this));
		this.setListener("banActor", this.banActor.bind(this));
		this.setListener("unbanActor", this.unbanActor.bind(this));
		this.setListener("addTopic", this.addTopic.bind(this));
		this.setListener("deleteTopic", this.deleteTopic.bind(this));
		this.setListener("fetchMessages", this.fetchMessages.bind(this));
		this.setListener("pushMessage", this.pushMessage.bind(this));
		this.setListener("addRelated", this.addRelated.bind(this));
		this.setListener("confirmRelated", this.confirmRelated.bind(this));
		this.setListener("updateRelated", this.updateRelated.bind(this));
		this.setListener("deleteRelated", this.deleteRelated.bind(this));

		this.setListener("addUser", this.addUser.bind(this));
		this.setListener("updateUser", this.updateUser.bind(this));
		this.setListener("deleteUser", this.deleteUser.bind(this));
		this.setListener("authUser", this.authUser.bind(this));
		this.setListener("fetchTitle", this.fetchTitle.bind(this));
		this.setListener("getNodeSettings", this.getNodeSettings.bind(this));
		this.setListener("setNodeSettings", this.setNodeSettings.bind(this));
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

	// users

	async addUser (event: Event) {
		try {
			const login = event.data.data.login as string;
			const password = event.data.data.password as string;

			const hash = await bcrypt.hash(password, 10);

			const info = this.db.prepare(`INSERT INTO users (login, password) VALUES (?, ?)`).run([login, hash]);
			this.db.prepare(`INSERT INTO actors (node_user_id, display_name) VALUES (?, ?)`).run([info.lastInsertRowid, login]);

			event.response({
				command: "addUserResponse",
				error: false,
				data: {
					id: info.lastInsertRowid
				}
			});
		} catch (err: any) {
			event.response({
				command: "addUserResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	async updateUser (event: Event) {
		try {
			const params: any[] = [];
			let sql: string = "UPDATE users SET is_admin=?, is_bot=? WHERE id=?";

			if (event.data.data.password) {
				const hash = await bcrypt.hash(event.data.data.password, 10);
				params.push(hash);
				sql = "UPDATE users SET password=?, is_admin=?, is_bot=? WHERE id=?";
			}

			params.push(event.data.data.is_admin, event.data.data.is_bot, event.data.data.id);

			const info = this.db.prepare(sql).run(params);

			if (info.changes === 0) throw new Error("User not found");

			event.response({
				command: "updateUserResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "updateUserResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	async changePassword (event: Event) {
		try {
			const hash = await bcrypt.hash(event.data.data.password, 10);

			const info = this.db.prepare("UPDATE users SET password=? WHERE id=?").run([hash, event.data.data.id]);

			if (info.changes === 0) throw new Error("User not found");

			event.response({
				command: "changePasswordResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "changePasswordResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	deleteUser (event: Event) {
		try {
			const id = event.data.data.id as number;

			const info = this.db.prepare(`DELETE FROM users WHERE id=?`).run([id]);

			if (info.changes === 0) throw new Error("User not found");

			event.response({
				command: "deleteUserResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "deleteUserResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	async authUser (event: Event) {
		try {
			const userRow = this.db.prepare("SELECT password, is_admin, is_bot FROM users WHERE login=?").get([ event.data.data.login ]) as { password: string; is_admin: boolean; is_bot: boolean; };

			if (!userRow) throw new Error("User not found");

			this.db.prepare("UPDATE users SET last_login=? WHERE login=?").run([Math.floor(Date.now()/1000), event.data.data.login]);

			const result = await bcrypt.compare(event.data.data.password, userRow.password);

			if (!result) throw new Error("Wrong password");

			event.response({
				command: "authUserResponse",
				error: false,
				data: {
					login: event.data.data.login,
					is_admin: userRow.is_admin,
					is_bot: userRow.is_bot
				}
			});
		} catch (err: any) {
			event.response({
				command: "authUserResponse",
				error: true,
				details: err.message || err.toString()
			})
		}
	}

	addActor (event: Event) {
		try {
			const info = this.db.prepare("INSERT INTO actors (node_id, node_user_id, display_name) VALUES (?, ?, ?)").run([event.data.data.node_id, event.data.data.node_user_id, event.data.data.display_name]);

			event.response({
				command: "addActorResponse",
				error: false,
				data: { id: info.lastInsertRowid }
			})
		} catch (err: any) {
			event.response({
				command: "addActorResponse",
				error: true,
				details: err.toString()
			})
		}
	}

	updateActor (event: Event) {
		try {
			this.db.prepare("UPDATE actors SET display_name=? WHERE node_id=? AND node_user_id=?").run([event.data.data.display_name, event.data.data.node_id, event.data.data.node_user_id]);

			event.response({
				command: "updateActorResponse",
				error: false
			})
		} catch (err: any) {
			event.response({
				command: "updateActorResponse",
				error: true,
				details: err.toString()
			})
		}
	}

	banActor (event: Event) {
		try {
			this.db.prepare("UPDATE actors SET is_banned=1 WHERE node_id=? AND node_user_id=?").run([event.data.data.node_id, event.data.data.node_user_id]);

			event.response({
				command: "banActorResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "banActorResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	unbanActor (event: Event) {
		try {
			this.db.prepare("UPDATE actors SET is_banned=0 WHERE node_id=? AND node_user_id=?").run([event.data.data.node_id, event.data.data.node_user_id]);

			event.response({
				command: "banActorResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "banActorResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	// topics

	async addTopic (event: Event) {
		try {
			let params: any[] = [];
			let sql: string = `INSERT INTO topics (creator_id, title, description, image_path, storage_count, is_temporary, guest_access) VALUES (?, ?, ?, ?, ?, ?, ?)`;

			if (event.data.data.password) {
				const hash = await bcrypt.hash(event.data.data.password, 10);
				params.push(hash);
				sql = `INSERT INTO topics (password, creator_id, title, description, image_path, storage_count, is_temporary, guest_access), VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
			}

			params.push(
				event.data.data.creator_id,
				event.data.data.title,
				event.data.data.description,
				event.data.data.image_path,
				event.data.data.storage_count,
				event.data.data.is_temporary,
				event.data.data.guest_access
			);

			const info = this.db.prepare(sql).run(params);

			event.response({
				command: "addTopicResponse",
				error: false,
				data: { id: info.lastInsertRowid }
			})
		} catch (err: any) {
			event.response({
				command: "addTopicResponse",
				error: true,
				details: err.toString()
			})
		}
	}

	async updateTopic (event: Event) {
		try {
			let params: any[] = [];
			let sql: string = `UPDATE topics SET title=?, description=?, image_path=?, storage_count=?, is_temporary=?, guest_access=? WHERE id=?`;

			if (event.data.data.password) {
				const hash = await bcrypt.hash(event.data.data.password, 10);
				params.push(hash);
				let sql: string = `UPDATE topics SET password=?, title=?, description=?, image_path=?, storage_count=?, is_temporary=?, guest_access=? WHERE id=?`;
			}

			params.push(
				event.data.data.title,
				event.data.data.description,
				event.data.data.image_path,
				event.data.data.storage_count,
				event.data.data.is_temporary,
				event.data.data.guest_access,
				event.data.data.id
			);

			const info = this.db.prepare(sql).run(params);

			if (info.changes === 0) throw new Error("Topic not found");

			event.response({
				command: "updateTopicResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "updateTopicResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	deleteTopic (event: Event) {
		try {
			const info = this.db.prepare(`DELETE FROM topics WHERE id=?`).run([event.data.data.id]);

			if (info.changes === 0) throw new Error("Topic not found");

			event.response({
				command: "deleteTopicResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "deleteTopicResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	// chat

	fetchMessages (event: Event) {
		try {
			let rows: any[];

			if (event.data.data.message_id) {
				rows = this.db.prepare(`SELECT
					messages.content,
					messages.attachments,
					messages.created_at,
					actors.display_name,
					actors.image_path
					FROM messages LEFT JOIN actors ON messages.actor_id=actors.id
					WHERE topic_id = ?
					AND messages.id < event.data.data.message_id,
					ORDER BY messages.id DESC
					LIMIT ?
				`).all([event.data.data.topic, event.data.data.limit]);
			} else {
				rows = this.db.prepare(`SELECT
					messages.content,
					messages.attachments,
					messages.created_at,
					actors.display_name,
					actors.image_path
					FROM messages LEFT JOIN actors ON messages.actor_id=actors.id
					WHERE topic_id = ?
					ORDER BY messages.id DESC
					LIMIT ?
				`).all([event.data.data.topic, event.data.data.limit]);
			}

			event.response({
				command: "fetchMessagesResponse",
				error: false,
				data: { rows: rows }
			});
		} catch (err: any) {
			event.response({
				command: "fetchMessagesResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	pushMessage (event: Event) {
		try {
			this.db.prepare(`INSERT INTO messages (
				content,
				attachments,
				created_at,
				actor_id,
				topic_id
			) VALUES (
				?,
				?,
				?,
				?,
				?
			);`).run([
				event.data.data.content,
				event.data.data.attachments,
				event.data.data.created_at,
				event.data.data.actor_id,
				event.data.data.topic_id
			]);

			event.response({
				command: "pushMessageResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "pushMessageResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	// related

	addRelated (event: Event) {
		try {
			if (event.data.data.confirmed) {
				this.db.prepare(`INSERT INTO related (uuid, url, title, description, is_visible) VALUES (?, ?, ?, ?)`).run([
					event.data.data.uuid,
					event.data.data.url,
					event.data.data.title,
					event.data.data.description,
					event.data.data.is_visible
				]);
			} else {
				this.db.prepare(`INSERT INTO pending_related (uuid, url, message) VALUES (?, ?, ?)`).run([
					event.data.data.uuid,
					event.data.data.url,
					event.data.data.message
				]);
			}

			event.response({
				command: "addRelatedResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "addRelatedResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	confirmRelated (event: Event) {
		try {
			const row = this.db.prepare(`SELECT uuid, url FROM pending_related WHERE id=?`).get([event.data.data.id]) as { uuid: string; url: string; };

			if (!row) throw new Error("Request not found");

			this.db.prepare(`INSERT INTO related (uuid, url, title, description, is_visible) VALUES (?, ?, ?, ?)`).run([row.uuid, row.url, event.data.data.title, event.data.data.description, event.data.data.is_visible]);
			this.db.prepare(`DELETE FROM pending_related WHERE id=?`).run([event.data.data.id]);

			event.response({
				command: "confirmRelatedResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "confirmRelatedResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	updateRelated (event: Event) {
		try {
			const info = this.db.prepare(`UPDATE related SET title=?, description=?, is_visible=? WHERE id=?`).run([event.data.data.title, event.data.data.description, event.data.data.is_visible, event.data.data.id]);

			if (info.changes === 0) throw new Error("Related node not found");

			event.response({
				command: "updateRelatedResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "updateRelatedResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	deleteRelated (event: Event) {
		try {
			const row = this.db.prepare(`SELECT uuid FROM related WHERE id=?`).get([event.data.data.id]) as { uuid: string };

			if (!row) throw new Error("Related node not found");

			this.db.prepare(`DELETE FROM related WHERE id=?`).run([event.data.data.id]);

			this.db.prepare(`DELETE FROM actors WHERE node_id=?`).run([row.uuid]);

			event.response({
				command: "deleteRelatedResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "deleteRelatedResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	fetchTitle (event: Event) {
		try {
			const row = this.db.prepare(`SELECT title_page FROM settings WHERE id=1`).get([]) as { title_page: string };

			event.response({
				command: "fetchTitleResponse",
				error: false,
				data: JSON.parse(row.title_page)
			});
		} catch (err: any) {
			event.response({
				command: "fetchTitleResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	getNodeSettings (event: Event) {
		try {
			const row = this.db.prepare(`SELECT * FROM settings WHERE id=1`).get([]);

			event.response({
				command: "getNodeSettingsResponse",
				error: false,
				data: row
			});
		} catch (err: any) {
			event.response({
				command: "getNodeSettingsResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	setNodeSettings (event: Event) {
		try {
			const row = this.db.prepare(`UPDATE settings SET name=?, description=?, title_page=?, http_port=?, gate_port=? WHERE id=1`).run([
				event.data.data.name,
				event.data.data.description,
				event.data.data.title_page,
				event.data.data.http_port,
				event.data.data.gate_port
			]);

			event.response({
				command: "setNodeSettingsResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "setNodeSettingsResponse",
				error: true,
				details: err.toString()
			});
		}
	}
}