import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function editUser (db: Database.Database, event: Event) {
	try {
		const params: any[] = [];
		let sql: string = "UPDATE users SET is_admin=?, is_bot=? WHERE login=?";

		params.push(event.data.data.is_admin, event.data.data.is_bot, event.data.data.login);

		const info = db.prepare(sql).run(params);

		if (info.changes === 0) throw new Error("User not found");

		event.response({
			command: "editUserResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "editUserResponse",
			error: true,
			details: err.toString()
		});
	}
}