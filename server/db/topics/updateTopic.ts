import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"
import bcrypt from "bcrypt"

export default async function updateTopic (db: Database.Database, event: Event) {
	try {
		const userRow = db.prepare(`SELECT (
			is_admin = 1 OR (SELECT creator_id FROM topics WHERE id=?)
		) as can_manage
		FROM users WHERE id=?`).get([ event.data.data.id, event.data.data.userId ]) as { can_manage: boolean };

		if (!userRow.can_manage) throw new Error("Access denied");

		if (event.data.data.password) {
			const hash = await bcrypt.hash(event.data.data.password, 10);

			db.prepare(`UPDATE topics SET
				title=?,
				description=?,
				guest_access=?,
				author_write_only=?,
				password=?
			WHERE id = ?
			`).run([ event.data.data.title, event.data.data.description, Number(event.data.data.guest_access), Number(event.data.data.author_write_only), hash, event.data.data.id ]);
		} else {
			db.prepare(`UPDATE topics SET
				title=?,
				description=?,
				guest_access=?,
				author_write_only=?
			WHERE id = ?
		`).run([ event.data.data.title, event.data.data.description, Number(event.data.data.guest_access), Number(event.data.data.author_write_only), event.data.data.id ]);
		}

		event.response({
			command: "updateTopicResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "updateTopicResponse",
			error: true,
			details: err.toString()
		})
	}
}