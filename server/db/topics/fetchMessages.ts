import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

interface MessageRow {
	id: number;
	content: string;
	file_path: string;
	actor_id: number;
	display_name: string;
	created_at: number;
	is_guest: boolean;
}

interface CombinedMessageRow {
	id: number;
	content: string;
	attachments: string[];
	actor_id: number;
	display_name: string;
	created_at: number;
	is_guest: boolean;
}

export default function fetchMessages (db: Database.Database, event: Event) {
	try {
		let rows: MessageRow[];

		if (event.data.data.offset !== -1) {
			const direction = event.data.data.direction;

			if (direction !== '<' && direction !== '>') throw new Error("Invalid direction");

			rows = db.prepare(`SELECT
				messages.id as id,
				messages.content as content,
				messages.created_at as created_at,
				actors.id as actor_id,
				actors.display_name as display_name,
				actors.node_id IS NOT NULL as is_guest,
				attachments.file_path as file_path
				FROM messages
				LEFT JOIN actors ON messages.actor_id=actors.id
				LEFT JOIN attachments ON attachments.message_id=messages.id
				WHERE messages.topic_id = ?
				AND messages.id ${direction} ?
				ORDER BY messages.id DESC
				LIMIT ?
			`).all([event.data.data.topic_id, event.data.data.offset, event.data.data.limit]) as MessageRow[];
		} else {
			rows = db.prepare(`SELECT
				messages.id as id,
				messages.content as content,
				messages.created_at as created_at,
				actors.id as actor_id,
				actors.display_name as display_name,
				actors.node_id IS NOT NULL as is_guest,
				attachments.file_path as file_path
				FROM messages
				LEFT JOIN actors ON messages.actor_id=actors.id
				LEFT JOIN attachments ON attachments.message_id=messages.id
				WHERE messages.topic_id = ?
				ORDER BY messages.id DESC
				LIMIT ?
			`).all([event.data.data.topic_id, event.data.data.limit]) as MessageRow[];
		}

		const map: Record<number, CombinedMessageRow> = {};

		for (const row of rows) {
			if (map[row.id] === undefined) {
				map[row.id] = {
					id: row.id,
					actor_id: row.actor_id,
					content: row.content,
					display_name: row.display_name,
					is_guest: row.is_guest,
					created_at: row.created_at,
					attachments: !!row.file_path ? [ row.file_path ] : []
				}
			} else {
				map[row.id].attachments.push(row.file_path);
			}
		}

		event.response({
			command: "fetchMessagesResponse",
			error: false,
			data: Object.values(map)
		});
	} catch (err: any) {
		event.response({
			command: "fetchMessagesResponse",
			error: true,
			details: err.toString()
		});
	}
}