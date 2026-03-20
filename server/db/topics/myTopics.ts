import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function myTopics (db: Database.Database, event: Event) {
	try {
		const rows = db.prepare(`SELECT
				id,
				title,
				description,
				guest_access,
				author_write_only,
				(password IS NOT NULL) as password_protected
			FROM topics
			WHERE creator_id = ?
		`).all([event.data.data.id]);

		event.response({
			command: "getUserTopicsResponse",
			error: false,
			data: rows	
		});
	} catch (err: any) {
		event.response({
			command: "getUserTopicsResponse",
			error: true,
			details: err.toString()
		});
	}
}