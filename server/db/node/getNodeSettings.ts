import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function getNodeSettings (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT uuid, title,	http_port, gate_port, description, title_page, ice_candidates, announced_ip FROM settings WHERE id=1`).get([]);

		event.response({
			command: "getNodeSettingsResponse",
			error: false,
			data: row
		});
	} catch (err: any) {
		event.response({
			command: "getNodeSettingsResponse",
			error: true,
			details: err.toString()
		});
	}
}