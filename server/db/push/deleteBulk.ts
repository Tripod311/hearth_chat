import { Event, Log } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function deletePushBulk (db: Database.Database, event: Event) {
	try {
		const placeholder = event.data.data.map((e: any) => '?').join(',');

		db.prepare(`DELETE FROM push_subscriptions WHERE endpoint IN (${placeholder})`).run(event.data.data);
	} catch (err: any) {
		Log.error(`DeletePushBulk error: ${err.toString()}`, 0);
	}
}