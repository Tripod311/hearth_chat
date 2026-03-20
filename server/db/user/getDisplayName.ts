import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function getDisplayName (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT
			display_name
		FROM actors
		WHERE node_user_id=? AND node_id IS NULL`).get([event.data.data.id]) as { display_name: string; };

		if (!row) throw new Error("User not found");

		event.response({
			command: "getDisplayNameResponse",
			error: false,
			data: row.display_name
		});
	} catch (err: any) {
		event.response({
			command: "getDisplayNameResponse",
			error: true,
			details: err.toString()
		});
	}
}