import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function setNodeSettings (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!ctx.locals.userInfo.is_admin) {
			ctx.status(403).json({ error: true, details: "Access forbidden" });

			resolve();
		} else {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "setNodeSettings",
				data: ctx.body
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false });

					const gateAddress = this.address!.parent.data;
					gateAddress.push("gate");

					this.send(gateAddress, {
						command: "nodeInfoChanged",
						data: {
							title: ctx.body.title,
							description: ctx.body.description
						}
					});

					resolve();
				}
			});
		}
	});
}