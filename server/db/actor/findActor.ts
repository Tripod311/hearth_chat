import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function findActor (db: Database.Database, event: Event) {
	try {
		if (event.data.data.node_id === null) {
			const row = db.prepare(`SELECT id, display_name FROM actors WHERE node_id IS NULL AND node_user_id=?`).get([
				event.data.data.node_user_id
			]) as { id: number; display_name: string; };

			if (row === undefined) throw new Error(`Actor not found`);

			event.response({
				command: "findActorResponse",
				error: false,
				data: row
			});
		} else {
			const row = db.prepare(`SELECT id, display_name FROM actors WHERE node_id=? AND node_user_id=?`).get([
				event.data.data.node_id,
				event.data.data.node_user_id
			]) as { id: number; display_name: string; };

			if (row === undefined) throw new Error(`Actor not found`);

			event.response({
				command: "findActorResponse",
				error: false,
				data: row
			});
		}
	} catch (err: any) {
		event.response({
			command: "findActorResponse",
			error: true,
			details: err.toString()
		});
	}
}