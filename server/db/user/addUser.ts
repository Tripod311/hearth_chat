import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"
import bcrypt from "bcrypt"

export default async function addUser (db: Database.Database, event: Event) {
	try {
		const login = event.data.data.login as string;
		const password = event.data.data.password as string;

		const hash = await bcrypt.hash(password, 10);

		const info = db.prepare(`INSERT INTO users (login, password) VALUES (?, ?)`).run([login, hash]);
		db.prepare(`INSERT INTO actors (node_user_id, display_name) VALUES (?, ?)`).run([info.lastInsertRowid, login]);

		event.response({
			command: "addUserResponse",
			error: false,
			data: {
				id: info.lastInsertRowid
			}
		});
	} catch (err: any) {
		event.response({
			command: "addUserResponse",
			error: true,
			details: err.toString()
		});
	}
}