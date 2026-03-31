import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function checkNodeRegistered (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT ip, port, title, description FROM related WHERE uuid=?`).get([ event.data.data.uuid ]);

		if (!row) throw new Error("Node not found");

		event.response({
			command: "checkNodeRegisteredResponse",
			error: false,
			data: row
		});
	} catch (err: any) {
		event.response({
			command: "checkNodeRegisteredResponse",
			error: true,
			details: err.toString()
		});
	}
}