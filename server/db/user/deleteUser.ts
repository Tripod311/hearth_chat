import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function deleteUser (db: Database.Database, event: Event) {
	try {
		const login = event.data.data.login as string;

		const row = db.prepare(`SELECT id FROM users WHERE login=?`).get([login]) as { id: number };

		if (!row) throw new Error("User not found");

		db.prepare(`DELETE FROM users WHERE id=?`).run([row.id]);
		db.prepare(`DELETE FROM actors WHERE node_id IS NULL AND node_user_id=?`).run([row.id]);
		db.prepare(`DELETE FROM topics WHERE creator_id=?`).run([row.id]);

		event.response({
			command: "deleteUserResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "deleteUserResponse",
			error: true,
			details: err.toString()
		});
	}
}