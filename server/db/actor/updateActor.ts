import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function updateActor (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT id FROM actors WHERE node_id=? AND node_user_id=?`).get([
			event.data.data.node_id,
			event.data.data.node_user_id
		]) as { id: number };

		if (row !== undefined) {
			db.prepare(`UPDATE actors SET display_name=? WHERE id=?`).run([ event.data.data.display_name, row.id ]);

			event.response({
				command: "updateActorResponse",
				error: false,
				data: { id: row.id }
			});
		} else {
			const info = db.prepare(`INSERT INTO actors (node_id, node_user_id, display_name, is_banned) VALUES (?, ?, ?, 0)`).run([
				event.data.data.node_id,
				event.data.data.node_user_id,
				event.data.data.display_name
			]);

			event.response({
				command: "updateActorResponse",
				error: false,
				data: { id: info.lastInsertRowid }
			});
		}
	} catch (err: any) {
		event.response({
			command: "updateActorResponse",
			error: true,
			details: err.toString()
		});
	}
}