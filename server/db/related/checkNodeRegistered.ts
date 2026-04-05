import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function checkNodeRegistered (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT uuid, ip, port, title, description, direct FROM related WHERE uuid=?`).get([ event.data.data.uuid ]);

		if (!row) throw new Error("The node is either offline or the handshake has not been completed");

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