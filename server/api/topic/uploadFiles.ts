import crypto from "crypto"
import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function uploadFiles (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const uuidPart = ctx.body["##nodeUUID##"];

		if (uuidPart !== undefined && uuidPart.originalFileName === undefined) {
			const gateAddress = this.address!.parent.data;
			gateAddress.push("gate");

			const files = Object.values(ctx.body).filter((p: any) => p.originalFileName !== undefined);

			this.chain(gateAddress, {
				command: "pushFiles",
				data: {
					uuid: uuidPart,
					files: files
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}

				resolve();
			});
		} else {
			const trackerAddress = this.address!.parent.data;
			trackerAddress.push("uploadsTracker");

			let toCheck: string[] = [];

			for (const partName in ctx.body) {
				const part = ctx.body[partName];
				if (part.originalFileName === undefined) continue;

				let ext: string = "";
				if (part.originalFileName.indexOf('.') !== -1) {
					const sp = part.originalFileName.split(".");
					ext = sp[sp.length - 1];
				}
				const rand = crypto.randomUUID();
				const newName = `./data/files/${rand}${ext.length > 0 ? '.' + ext : ''}`;
				const attName = `${rand}${ext.length > 0 ? '.' + ext : ''}`;

				part.move(newName);

				toCheck.push(attName);
			}

			this.send(trackerAddress, {
				command: "remember",
				data: { files: toCheck }
			});

			ctx.status(200).json({ error: false, data: toCheck });

			resolve();
		}
	});
}