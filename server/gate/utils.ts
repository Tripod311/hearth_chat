import FS from "fs"
import type { Stats } from "fs"

export async function waitFileSize (path: string, retries: number = 5, delay: number = 10): Promise<Stats> {
	for (let i=0; i<retries; i++) {
		const stat = await FS.promises.stat(path)

		if (stat.size !== 0) {
			return stat;
		}

		await new Promise((resolve) => { setTimeout(resolve, delay) })
	}

	throw new Error("Invalid file size");
}