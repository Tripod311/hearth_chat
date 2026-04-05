import { Context } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function acceptHandshake (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!ctx.locals.userInfo.is_admin) {
			ctx.status(403).json({ error: true, details: "Access forbidden" });

			resolve();
		} else {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "acceptHandshake",
				data: { id: ctx.body.id }
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					const gateAddress = this.address!.parent.data;
					gateAddress.push("gate");

					this.send(gateAddress, {
						command: "connectNode",
						data: { uuid: response.data.data.uuid }
					});

					ctx.status(200).json({ error: false, data: response.data.data });
				}

				resolve();
			});
		}
	});
}