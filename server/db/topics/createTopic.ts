import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"
import bcrypt from "bcrypt"

export default async function createTopic (db: Database.Database, event: Event) {
	try {
		if (event.data.data.password) {
			const hash = await bcrypt.hash(event.data.data.password, 10);

			db.prepare(`INSERT INTO topics (
				creator_id,
				title,
				description,
				guest_access,
				author_write_only,
				password
			) VALUES (
				?,
				?,
				?,
				?,
				?,
				?
			)`).run([ event.data.data.creator_id, event.data.data.title, event.data.data.description, Number(event.data.data.guest_access), Number(event.data.data.author_write_only), hash ]);
		} else {
			db.prepare(`INSERT INTO topics (
				creator_id,
				title,
				description,
				guest_access,
				author_write_only
			) VALUES (
				?,
				?,
				?,
				?,
				?
			)`).run([ event.data.data.creator_id, event.data.data.title, event.data.data.description, Number(event.data.data.guest_access), Number(event.data.data.author_write_only) ]);
		}

		event.response({
			command: "createTopicResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "createTopicResponse",
			error: true,
			details: err.toString()
		})
	}
}