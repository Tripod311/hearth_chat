import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function nodeOffline (db: Database.Database, event: Event) {
	try {
		db.prepare(`UPDATE related SET is_alive=0 WHERE uuid=?`).run([ event.data.data.uuid ]);
	} catch (err: any) {
		Log.error(`NodeOffline error: ${err.toString()}`, 0);
	}
}