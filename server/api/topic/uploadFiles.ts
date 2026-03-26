import crypto from "crypto"
import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function uploadFiles (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const trackerAddress = this.address!.parent.data;
		trackerAddress.push("uploadsTracker");

		let toCheck: string[] = [];
		let toReturn: string[] = [];

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
			toReturn.push(attName);
		}

		this.send(trackerAddress, {
			command: "remember",
			data: { files: toCheck }
		});

		ctx.status(200).json({ error: false, data: toReturn });
	});
}