import FS from "fs"
import path from "path"
import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default async function getLocales (this: Node, ctx: Context): Promise<void> {
	try {
		const stat = await FS.promises.stat("./data/locales");

		if (!stat.isDirectory()) throw new Error("data/locales is not a directory");

		const files = await FS.promises.readdir("./data/locales", { withFileTypes: true });
		const result: Record<string, Record<string, string>> = {};

		for (const file of files) {
			if (file.isFile() && file.name.endsWith(".json")) {
				result[path.parse(file.name).name] = JSON.parse(await FS.promises.readFile(path.join('./data/locales', file.name), "utf-8"));
			}
		}

		ctx.status(200).json({ error: false, data: result });
	} catch (err: any) {
		ctx.status(404).json({ error: true, details: err.toString() });
	}
}