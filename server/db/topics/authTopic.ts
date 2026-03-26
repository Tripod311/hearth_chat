import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default async function authTopic (db: Database.Database, event: Event) {
	try {
		

		event.response({
			command: "authTopicResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "authTopicResponse",
			error: true,
			details: err.toString()
		});
	}
}