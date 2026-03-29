import { Context } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function rejectHandshake (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		if (ctx.locals.userInfo.is_admin) {
			ctx.status(403).json({ error: true, details: "Access forbidden" });
		} else {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "rejectHandshake",
				data: { id: ctx.body.id }
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}
			});
		}
	});
}