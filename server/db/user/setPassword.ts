import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"
import bcrypt from "bcrypt"

export default async function setPassword (db: Database.Database, event: Event) {
	try {
		const hash = await bcrypt.hash(event.data.data.password, 10);

		const info = db.prepare("UPDATE users SET password=? WHERE login=?").run([hash, event.data.data.login]);

		if (info.changes === 0) throw new Error("User not found");

		event.response({
			command: "setPasswordResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "setPasswordResponse",
			error: true,
			details: err.toString()
		});
	}
}