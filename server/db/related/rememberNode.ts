import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function rememberNode (db: Database.Database, event: Event) {
	try {
		db.prepare(`INSERT INTO related (uuid, ip, port) VALUES (?, ?, ?)`).run([ event.data.data.uuid, event.data.data.ip, event.data.data.port ]);
	} catch (err: any) {
		Log.warning(`rememberNode error: ${err.toString()}`, 0);
	}
}