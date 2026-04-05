import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function findRemoteActor (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT id, display_name, is_banned FROM actors WHERE node_id=? AND node_user_id=?`).get([
			event.data.data.node_id,
			event.data.data.node_user_id
		]);

		if (row === undefined) throw new Error(`Actor not found`);

		event.response({
			command: "findRemoteActorResponse",
			error: false,
			data: row
		});
	} catch (err: any) {
		event.response({
			command: "findRemoteActorResponse",
			error: true,
			details: err.toString()
		});
	}
}