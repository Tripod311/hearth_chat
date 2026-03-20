import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function deleteTopic (db: Database.Database, event: Event) {
	try {
		const userRow = db.prepare(`SELECT (
			is_admin = 1 OR (SELECT creator_id FROM topics WHERE id=?)
		) as can_manage
		FROM users WHERE id=?`).get([ event.data.data.id, event.data.data.userId ]) as { can_manage: boolean };

		if (!userRow.can_manage) throw new Error("Access denied");
			
		// delete all messages and attachments
		
		db.prepare(`DELETE FROM topics WHERE id=?`).run([ event.data.data.id ]);

		event.response({
			command: "deleteTopicResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "deleteTopicResponse",
			error: true,
			details: err.toString()
		})
	}
}