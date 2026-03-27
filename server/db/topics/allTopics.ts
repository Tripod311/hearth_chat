import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function allTopics (db: Database.Database, event: Event) {
	try {
		const rows = db.prepare(`SELECT
				topics.id as id,
				topics.title as title,
				topics.description as description,
				topics.guest_access as guest_access,
				topics.author_write_only as author_write_only,
				(topics.password IS NOT NULL) as password_protected,
				actors.node_user_id as creator_id,
				actors.display_name as creator_name
			FROM topics
			LEFT JOIN actors ON actors.node_user_id = topics.creator_id
		`).all();

		event.response({
			command: "getAllTopicsResponse",
			error: false,
			data: rows	
		});
	} catch (err: any) {
		event.response({
			command: "getAllTopicsResponse",
			error: true,
			details: err.toString()
		});
	}
}