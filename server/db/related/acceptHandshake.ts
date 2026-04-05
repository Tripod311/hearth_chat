import { Event } from "@tripod311/dispatch"
import Database from "better-sqlite3"

export default function acceptHandshake (db: Database.Database, event: Event) {
	try {
		const row = db.prepare(`SELECT uuid, ip, port, title, description FROM pending_related WHERE id=?`)
			.get([ event.data.data.id ]) as { uuid: string; ip: string; port: number; title: string; description: string; };

		if (!row) throw new Error("Handshake not found");

		db.prepare(`DELETE FROM pending_related WHERE id=?`).run([ event.data.data.id ]);

		db.prepare(`INSERT INTO related (
			uuid,
			ip,
			port,
			title,
			description,
			direct
		) VALUES (
			?,
			?,
			?,
			?,
			?,
			1
		)`).run([ row.uuid, row.ip, row.port, row.title, row.description ]);

		event.response({
			command: "acceptHandshakeResponse",
			error: false,
			data: { uuid: row.uuid }
		});
	} catch (err: any) {
		event.response({
			command: "acceptHandshakeResponse",
			error: true,
			details: err.toString()
		});
	}
}