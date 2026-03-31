import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function nodeHandshake (db: Database.Database, event: Event) {
	try {
		db.prepare(`INSERT INTO pending_related (ip, port, uuid, title, description, message) VALUES (?, ?, ?, ?, ?, ?)`).run([
			event.data.data.ip,
			event.data.data.port,
			event.data.data.uuid,
			event.data.data.title,
			event.data.data.description,
			event.data.data.message
		]);

		const row = db.prepare(`SELECT uuid, gate_port as port, title, description FROM settings WHERE id=1`).get()

		event.response({
			command: "nodeHandshakeResponse",
			error: false,
			data: row
		});
	} catch (err: any) {
		event.response({
			command: "nodeHandshakeResponse",
			error: true,
			details: err.toString()
		});
	}
}