import { Context } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function nodeHandshake (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		const ip = ctx.raw.httpVersion === 1 ? ctx.raw.req.socket.remoteAddress : ctx.raw.stream?.session?.socket.remoteAddress;

		this.chain(dbAddress, {
			command: "nodeHandshake",
			data: {
				ip: ip,
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
				ctx.status(200).json({ error: false });
			}
		});
	});
}