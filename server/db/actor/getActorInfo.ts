import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function getActorInfo (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT
			actors.id as id,
			actors.node_id as node_id,
			actors.node_user_id as node_user_id,
			actors.display_name as display_name,
			actors.is_banned as is_banned,
			related.title as node_title
		FROM actors LEFT JOIN related ON actors.node_id = related.uuid
		WHERE actors.id = ?`).get([
			event.data.data.id
		]);

		if (row === undefined) throw new Error(`Actor not found`);

		event.response({
			command: "getActorInfoResponse",
			error: false,
			data: row
		});
	} catch (err: any) {
		event.response({
			command: "getActorInfoResponse",
			error: true,
			details: err.toString()
		});
	}
}