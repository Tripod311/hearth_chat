import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function setNodeSettings (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`UPDATE settings SET name=?, description=?, title_page=?, http_port=?, gate_port=?, ice_candidates=?, announced_ip=? WHERE id=1`).run([
			event.data.data.name,
			event.data.data.description,
			event.data.data.title_page,
			event.data.data.http_port,
			event.data.data.gate_port,
			event.data.data.ice_candidates,
			event.data.data.announced_ip
		]);

		event.response({
			command: "setNodeSettingsResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "setNodeSettingsResponse",
			error: true,
			details: err.toString()
		});
	}
}