import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function deletePushSubscription (db: Database.Database, event: Event) {
	try {
		db.prepare(`DELETE FROM push_subscriptions WHERE endpoint=?`).run([ event.data.data.endpoint ]);

		event.response({
			command: "deletePushSubscriptionResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "deletePushSubscriptionResponse",
			error: true,
			details: err.toString()
		});
	}
}