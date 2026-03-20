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
				actors.display_name as creator
			FROM topics
			LEFT JOIN actors ON actors.id = topics.creator_id
			WHERE topics.creator_id = ? AND actors.node_id IS NULL
		`).all([event.data.data.id]);

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