import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function addPushSubscription (db: Database.Database, event: Event) {
	try {
		db.prepare(`INSERT INTO push_subscriptions (
			user_id,
			endpoint,
			p256dh,
			auth
		) VALUES (
			?,
			?,
			?,
			?
		)`).run([
			event.data.data.user_id,
			event.data.data.endpoint,
			event.data.data.p256dh,
			event.data.data.auth
		]);

		event.response({
			command: "addPushSubscriptionResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "addPushSubscriptionResponse",
			error: true,
			details: err.toString()
		});
	}
}