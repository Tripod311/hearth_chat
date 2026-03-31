import { Context } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function goTo (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const gateAddress = this.address!.parent.data;
		gateAddress.push("gate");

		this.chain(gateAddress, {
			command: "connectNode",
			data: { uuid: ctx.body.to, ref_uuid: ctx.body.from }
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(500).json({ error: true, details: response.data.details });
			} else {
				ctx.status(200).json({ error: false });
			}

			resolve();
		});
	});
}