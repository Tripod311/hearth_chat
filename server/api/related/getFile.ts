import path from "path"
import { Context } from "@tripod311/currents"
import { ServeStatic } from "@tripod311/currents/node"
import { Node, Event } from "@tripod311/dispatch"
import type API from "../../api.js"

const localFiles = ServeStatic({
	basePath: "/self/files/",
	rootDir: path.join(process.cwd(), 'data/files'),
	cacheControl: ["public", "max-age=31536000", "immutable"]
});

export default function getFile (this: API, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		if (ctx.params.nodeId === "self") {
			localFiles(ctx).then(() => {
				resolve();
			});
		} else {
			const gateAddress = this.address!.parent.data;
			gateAddress.push("gate");

			this.chain(gateAddress, {
				command: "getFile",
				data: { uuid: ctx.params.nodeId, name: ctx.params.fileName }
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).send(response.data.data.stream, response.data.data.size);
				}

				resolve();
			});
		}
	});
}