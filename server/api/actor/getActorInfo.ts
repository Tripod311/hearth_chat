import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function getActorInfo (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const nodeId = ctx.body.nodeId;

		if (nodeId === "self") {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "getActorInfo",
				data: ctx.body
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}

				resolve();
			});
		} else {
			const gateAddress = this.address!.parent.data;
			gateAddress.push("gate");

			this.chain(gateAddress, {
				command: "getActorInfo",
				data: {
					uuid: nodeId,
					id: ctx.body.id
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}

				resolve();
			});
		}
	});
}