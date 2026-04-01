import { Context } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"
import type API from "../../api.js"

export default function getFile (this: API, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const gateAddress = this.address!.parent.data;
		gateAddress.push("gate");

		this.chain(gateAddress, {
			command: "getFile",
			data: { uuid: ctx.params.nodeId, name: ctx.params.fileName }
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(500).json({ error: true, details: response.data.details });
			} else {
				ctx.status(200).binary(Buffer.from(response.data.data.content));
			}

			resolve();
		});
	});
}