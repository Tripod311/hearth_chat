import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function fetchTitle (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT title_page FROM settings WHERE id=1`).get([]) as { title_page: string };

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