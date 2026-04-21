import { Context } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

function normalizedIP (ip: string): string {
	return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export default function nodeHandshake (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		const ip = ctx.raw.rawHTTP.version === 1 ? ctx.raw.rawHTTP.req.socket.remoteAddress : ctx.raw.rawHTTP.stream?.session?.socket.remoteAddress;

		this.chain(dbAddress, {
			command: "nodeHandshake",
			data: {
				ip: normalizedIP(ip as string),
				port: ctx.body.port,
				uuid: ctx.body.uuid,
				title: ctx.body.title,
				description: ctx.body.description,
				message: ctx.body.message
			}
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(500).json({ error: true, details: response.data.details });
			} else {
				ctx.status(200).json({ error: false, data: response.data.data });
			}

			resolve();
		});
	});
}