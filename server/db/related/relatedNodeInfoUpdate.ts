import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function relatedNodeInfoUpdate (db: Database.Database, event: Event) {
	try {
		db.prepare(`UPDATE related SET title=?, description=? WHERE uuid=?`).run([ event.data.data.title, event.data.data.description, event.data.data.uuid ]);
	} catch (err: any) {
		Log.warning(`relatedNodeInfoUpdate error: ${err.toString()}`, 0);
	}
}