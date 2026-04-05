import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function fetchNodeTitle (db: Database.Database, event: Event) {
	try {
		if (event.data.data.uuid === "self") {
			const row = db.prepare(`SELECT title FROM settings WHERE id=1`).get([]) as { title: string };

			event.response({
				command: "fetchNodeTitleResponse",
				error: false,
				data: row.title
			});
		} else {
			const row = db.prepare(`SELECT title FROM related WHERE uuid=?`).get([event.data.data.uuid]) as { title: string };

			event.response({
				command: "fetchNodeTitleResponse",
				error: false,
				data: row.title
			});
		}
	} catch (err: any) {
		event.response({
			command: "fetchNodeTitleResponse",
			error: true,
			details: err.toString()
		});
	}
}