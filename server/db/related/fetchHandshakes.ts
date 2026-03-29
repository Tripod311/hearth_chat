import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function fetchHandshakes (db: Database.Database, event: Event) {
	try {
		const rows = db.prepare(`SELECT id, message FROM pending_related`).all();

		event.response({
			command: "fetchHandshakesResponse",
			error: false,
			data: rows	
		});
	} catch (err: any) {
		event.response({
			command: "fetchHandshakesResponse",
			error: true,
			details: err.toString()
		});
	}
}