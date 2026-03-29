import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function nodeOnline (db: Database.Database, event: Event) {
	try {
		db.prepare(`UPDATE related SET is_alive=1 WHERE uuid=?`).run([ event.data.data.uuid ]);
	} catch (err: any) {
		Log.error(`NodeOnline error: ${err.toString()}`, 0);
	}
}