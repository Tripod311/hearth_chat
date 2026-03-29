import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function fetchDirectNodes (db: Database.Database, event: Event) {
	try {
		const rows = db.prepare(`SELECT uuid, ip, port, title, description FROM related WHERE direct=1`).all();

		event.response({
			command: "fetchDirectNodesResponse",
			error: false,
			data: rows	
		});
	} catch (err: any) {
		event.response({
			command: "fetchDirectNodesResponse",
			error: true,
			details: err.toString()
		});
	}
}