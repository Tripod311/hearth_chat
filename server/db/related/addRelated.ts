import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function addRelated (db: Database.Database, event: Event) {
	try {
		db.prepare(`INSERT INTO related (uuid, title, description, ip, port, direct) VALUES (?, ?, ?, ?, ?, ?)`).run([
			event.data.data.uuid,
			event.data.data.title,
			event.data.data.description,
			event.data.data.ip,
			event.data.data.port,
			1
		]);

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