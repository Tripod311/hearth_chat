import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function setDisplayName (db: Database.Database, event: Event) {
	try {
		const info = db.prepare(`UPDATE actors SET display_name = ? WHERE node_id IS NULL AND node_user_id = ?`).run([event.data.data.displayName, event.data.data.id]);

		event.response({
			command: "setDisplayNameResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "setDisplayNameResponse",
			error: true,
			details: err.toString()
		});
	}
}