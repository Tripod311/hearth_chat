import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"
import bcrypt from "bcrypt"

export default async function authTopic (db: Database.Database, event: Event) {
	try {
		const row = db.prepare("SELECT password FROM topics WHERE id=?").get([ event.data.data.topic_id ]) as { password: string; };

		if (!row) throw new Error("Topic not found");

		const result = await bcrypt.compare(event.data.data.password, row.password);

		if (!result) throw new Error("Wrong password");

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