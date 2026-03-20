import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function getUsers (db: Database.Database, event: Event) {
	try {
		if (!event.data.data.filter || event.data.data.filter.length === 0) {
			const rows = db.prepare(`SELECT login, is_admin, is_bot, last_login FROM users LIMIT ? OFFSET ?`).all([event.data.data.limit, event.data.data.offset]);

			event.response({
				command: "getUsersResponse",
				error: false,
				data: rows	
			});
		} else {
			const rows = db.prepare(`SELECT login, is_admin, is_bot, last_login FROM users WHERE login LIKE ? LIMIT ? OFFSET ?`).all(['%' + event.data.data.filter + '%', event.data.data.limit, event.data.data.offset]);

			event.response({
				command: "getUsersResponse",
				error: false,
				data: rows	
			});
		}
	} catch (err: any) {
		event.response({
			command: "getUsersResponse",
			error: true,
			details: err.toString()
		});
	}
}