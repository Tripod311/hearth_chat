import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function banActor (db: Database.Database, event: Event) {
	try {
		db.prepare(`UPDATE actors SET is_banned=1 WHERE id=?`).run([
			event.data.data.id
		]);

		event.response({
			command: "banActorResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "banActorResponse",
			error: true,
			details: err.toString()
		});
	}
}