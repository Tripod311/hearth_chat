import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function unbanActor (db: Database.Database, event: Event) {
	try {
		db.prepare(`UPDATE actors SET is_banned=0 WHERE id=?`).run([
			event.data.data.id
		]);

		event.response({
			command: "unbanActorResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "unbanActorResponse",
			error: true,
			details: err.toString()
		});
	}
}