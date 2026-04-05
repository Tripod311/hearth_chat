import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function getActors (db: Database.Database, event: Event) {
	try {
		if (!event.data.data.filter || event.data.data.filter.length === 0) {
			const rows = db.prepare(`SELECT
				actors.id as id,
				actors.node_id as node_id,
				actors.node_user_id as node_user_id,
				actors.display_name as display_name,
				actors.is_banned as is_banned,
				related.title as node_title
			FROM actors LEFT JOIN related ON actors.node_id = related.uuid
			LIMIT ? OFFSET ?`).all([event.data.data.limit, event.data.data.offset]);

			event.response({
				command: "getActorsResponse",
				error: false,
				data: rows	
			});
		} else {
			const rows = db.prepare(`SELECT
				actors.id as id,
				actors.node_id as node_id,
				actors.node_user_id as node_user_id,
				actors.display_name as display_name,
				actors.is_banned as is_banned,
				related.title as node_title
			FROM actors LEFT JOIN related ON actors.node_id = related.uuid
			WHERE actors.display_name LIKE ? OR related.title LIKE ?
			LIMIT ? OFFSET ?`).all([ '%' + event.data.data.filter + '%', '%' + event.data.data.filter + '%', event.data.data.limit, event.data.data.offset]);

			event.response({
				command: "getActorsResponse",
				error: false,
				data: rows	
			});
		}
	} catch (err: any) {
		event.response({
			command: "getActorsResponse",
			error: true,
			details: err.toString()
		});
	}
}