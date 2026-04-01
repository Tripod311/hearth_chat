import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function fetchPushSubscriptions (db: Database.Database, event: Event) {
	try {
		const rows = db.prepare(`SELECT * FROM push_subscriptions`).all();

		event.response({
			command: "fetchPushSubscriptionResponse",
			error: false,
			data: rows
		});
	} catch (err: any) {
		event.response({
			command: "fetchPushSubscriptionResponse",
			error: true,
			details: err.toString()
		});
	}
}