import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function rejectHandshake (db: Database.Database, event: Event) {
	try {
		db.prepare(`DELETE FROM pending_related WHERE id=?`).run([ event.data.data.id ]);

		event.response({
			command: "rejectHandshakeResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "rejectHandshakeResponse",
			error: true,
			details: err.toString()
		});
	}
}