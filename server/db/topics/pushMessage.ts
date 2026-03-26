import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

interface MessageInfo {
	content: string;
	attachments: string[];
	created_at: number;
	actor_id: number;
	topic_id: number;
}

export default function pushMessage (db: Database.Database, event: Event) {
	try {
		const { content, attachments, actor_id, topic_id, created_at } = event.data.data as MessageInfo;

		const info = db.prepare(`INSERT INTO messages (
			content,
			created_at,
			actor_id,
			topic_id
		) VALUES (
			?,
			?,
			?,
			?
		);`).run([
			content,
			created_at,
			actor_id,
			topic_id
		]);

		if (attachments.length > 0) {
			const statement = db.prepare(`INSERT INTO attachments (message_id, file_path) VALUES (?, ?)`);
			const tr = db.transaction(() => {
				for (const filepath of attachments) {
					statement.run([ info.lastInsertRowid, filepath ]);
				}
			});
			tr();
		}

		event.response({
			command: "pushMessageResponse",
			error: false,
			data: { id: info.lastInsertRowid }
		});
	} catch (err: any) {
		event.response({
			command: "pushMessageResponse",
			error: true,
			details: err.toString()
		});
	}
}