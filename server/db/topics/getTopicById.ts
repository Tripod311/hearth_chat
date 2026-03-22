import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function getTopicById (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT
				topics.title as title,
				topics.description as description,
				topics.guest_access as guest_access,
				topics.author_write_only as author_write_only,
				(topics.password IS NOT NULL) as password_protected,
				topics.creator_id as author_id
			FROM topics
			LEFT JOIN actors ON actors.id = topics.creator_id
			WHERE topics.id = ?
		`).get([event.data.data.id]);

		if (row === undefined) throw new Error("Topic not found");

		event.response({
			command: "getTopicByIdResponse",
			error: false,
			data: row
		});
	} catch (err: any) {
		event.response({
			command: "getTopicByIdResponse",
			error: true,
			details: err.toString()
		});
	}
}