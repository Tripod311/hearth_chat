import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function pushMessage (db: Database.Database, event: Event) {
	try {
		const now = Date.now() / 1000;

		db.prepare(`INSERT INTO messages (
			topic_id,
			actor_id,
			content,
			created_at
		) VALUES (?, ?, ?, ?)`).run([
			event.data.data.topic_id,
			event.data.data.actor_id,
			event.data.data.content,
			now
		]);

		event.response({
			command: "pushMessageResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "pushMessageResponse",
			error: true,
			details: err.toString()
		});
	}
}