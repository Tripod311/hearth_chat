import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"
import bcrypt from "bcrypt"

export default async function authUser (db: Database.Database, event: Event) {
	try {
		const userRow = db.prepare("SELECT id, password, is_admin, is_bot FROM users WHERE login=?").get([ event.data.data.login ]) as { id: number; password: string; is_admin: boolean; is_bot: boolean; };

		if (!userRow) throw new Error("User not found");

		db.prepare("UPDATE users SET last_login=? WHERE login=?").run([Math.floor(Date.now()/1000), event.data.data.login]);

		const result = await bcrypt.compare(event.data.data.password, userRow.password);

		if (!result) throw new Error("Wrong password");

		event.response({
			command: "authUserResponse",
			error: false,
			data: {
				id: userRow.id,
				login: event.data.data.login,
				is_admin: userRow.is_admin,
				is_bot: userRow.is_bot
			}
		});
	} catch (err: any) {
		event.response({
			command: "authUserResponse",
			error: true,
			details: err.message || err.toString()
		})
	}
}