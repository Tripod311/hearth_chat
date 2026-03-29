import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function forgetRelated (db: Database.Database, event: Event) {
	try {
		db.prepare(`DELETE FROM related WHERE uuid=?`).run([ event.data.data.uuid ]);

		event.response({
			command: "forgetRelatedResponse",
			error: false
		});
	} catch (err: any) {
		event.response({
			command: "forgetRelatedResponse",
			error: true,
			details: err.toString()
		});
	}
}