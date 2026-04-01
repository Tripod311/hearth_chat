import path from "path"
import crypto from "crypto"
import FS from "fs"
import { Node, Dispatcher, Address, Event, Log, StreamProcessor, SerializeEvent } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import { StreamingMultipartFile } from "@tripod311/currents"

const FILE_TIMEOUT = 1000 * 60 * 5;

interface PushRequest {
	baseEvent: Event;
	baseFiles: StreamingMultipartFile[];
	responseNames: string[];
	pendingId: number;
	pendingResponseSuccess?: Function;
	pendingResponseError?: Function;
	timeout?: ReturnType<typeof setTimeout>;
}

interface GetRequest {
	baseEvent: Event;
	timeout: ReturnType<typeof setTimeout>;
}

export default class FileHandles extends Node {
	public onEvent!: (data: EventData) => void;

	private pushCounter: number = 0;
	private waitingPushes: Record<number, PushRequest> = {};
	private getCounter: number = 0;
	private waitingGets: Record<number, GetRequest> = {};

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("pushFiles", this.pushFiles.bind(this));
		this.setListener("getFile", this.getFile.bind(this));
	}

	detach () {
		for (const id in this.waitingPushes) {
			clearTimeout(this.waitingPushes[id].timeout);
			this.waitingPushes[id].baseEvent.response({
				command: "pushFilesResponse",
				error: true,
				details: "Node disconnected"
			});
			this.clearPush(parseInt(id));
		}

		for (const id in this.waitingGets) {
			clearTimeout(this.waitingGets[id].timeout);
			this.waitingGets[id].baseEvent.response({
				command: "getFileResponse",
				error: true,
				details: "Node disconnected"
			});
			this.clearGet(parseInt(id));
		}

		super.detach();
	}

	async pushFiles (event: Event) {
		const id = this.pushCounter++;

		const files = event.data.data.files as StreamingMultipartFile[];
			
		this.waitingPushes[id] = {
			baseEvent: event,
			baseFiles: files,
			responseNames: [],
			pendingId: 0
		}

		try {
			while (this.waitingPushes[id].pendingId < this.waitingPushes[id].baseFiles.length) {
				await this.pushOneFile(id);
				this.waitingPushes[id].pendingId++;
			}

			this.waitingPushes[id].baseEvent.response({
				command: "pushFilesResponse",
				error: false,
				data: this.waitingPushes[id].responseNames
			});

			await this.clearPush(id);
		} catch (err: any) {
			this.waitingPushes[id].baseEvent.response({
				command: "pushFilesResponse",
				error: true,
				details: err.toString()
			});

			await this.clearPush(id);
		}
	}

	pushOneFile (pushId: number): Promise<string> {
		return new Promise((resolve, reject) => {
			const push = this.waitingPushes[pushId];
			push.pendingResponseSuccess = resolve;
			push.pendingResponseError = reject;
			push.timeout = setTimeout(this.clearPush.bind(this, pushId), FILE_TIMEOUT);

			const file = push.baseFiles[push.pendingId];

			FS.readFile(file.tmpLink, (err, content) => {
				if (err) {
					reject(err);
				} else {
					let ext: string = "";
					if (file.originalFileName.indexOf('.') !== -1) {
						const sp = file.originalFileName.split('.');
						ext = sp[sp.length-1];
					}

					const toSend = new Uint8Array(content);

					this.onEvent({
						command: "pushOneFile",
						data: {
							pushId: pushId,
							ext: ext,
							content: toSend
						}
					});
				}
			});
		});
	}

	processPushOneFileResponse (data: EventData) {
		const pushId = data.data.pushId;

		if (this.waitingPushes[pushId]) {
			clearTimeout(this.waitingPushes[pushId].timeout);

			if (!data.data.ok) {
				const fn = this.waitingPushes[pushId].pendingResponseError as Function;
				fn(data.data.details);
			} else {
				this.waitingPushes[pushId].responseNames.push(data.data.name);
				this.waitingPushes[pushId].pendingId++;
				const fn = this.waitingPushes[pushId].pendingResponseSuccess as Function;
				fn();
			}
		}
	}

	async clearPush (pushId: number) {
		if (this.waitingPushes[pushId]) {
			clearTimeout(this.waitingPushes[pushId].timeout);
			for (const file of this.waitingPushes[pushId].baseFiles) {
				await file.clear();
			}
			delete this.waitingPushes[pushId];
		}
	}

	async processPushOneFile (data: EventData) {
		const pushId = data.data.pushId;
		const ext = data.data.ext;
		const content = data.data.content;

		let fName = crypto.randomUUID();
		if (ext) fName += '.' + ext;
		const fullName = `./data/files/${fName}`;

		try {
			await FS.promises.writeFile(fullName, content);

			const trackerAddr = this.address!.parent.parent.data;
			trackerAddr.push("uploadsTracker");

			this.send(trackerAddr, {
				command: "remember",
				data: { files: [ fName ] }
			});

			this.onEvent({
				command: "pushOneFileResponse",
				error: false,
				data: { ok: true, pushId: pushId, name: fName }
			});
		} catch (err: any) {
			await FS.promises.rm(fullName, { force: true });

			this.onEvent({
				command: "pushOneFileResponse",
				error: false,
				data: { ok: false, details: err.toString() }
			});
		}
	}

	getFile (event: Event) {
		const getId = this.getCounter++;
		this.waitingGets[getId] = {
			baseEvent: event,
			timeout: setTimeout(this.clearGet.bind(this, getId), FILE_TIMEOUT)
		};

		this.onEvent({
			command: "getFile",
			data: {
				id: getId,
				name: event.data.data.name
			}
		});
	}

	async processGetFile (data: EventData) {
		const getId = data.data.id;
		const fName = data.data.name;

		try {
			const dirPath = `${process.cwd()}/data/files`;
			const fullPath = path.resolve(dirPath, fName);

			// serve files only from files directory
			if (!fullPath.startsWith(dirPath)) {
				throw new Error("Invalid path");
			}

			const content = await FS.promises.readFile(fullPath);

			this.onEvent({
				command: "getFileResponse",
				data: {
					ok: true,
					id: getId,
					content: new Uint8Array(content)
				}
			});
		} catch (err: any) {
			this.onEvent({
				command: "getFileResponse",
				data: {
					ok: false,
					id: getId,
					details: err.toString()
				}
			});
		}
	}

	processGetFileResponse (data: EventData) {
		const getId = data.data.id;

		if (this.waitingGets[getId]) {
			if (data.data.ok) {
				this.waitingGets[getId].baseEvent.response({
					command: "getFileResponse",
					error: false,
					data: { content: data.data.content }
				});
			} else {
				this.waitingGets[getId].baseEvent.response({
					command: "getFileResponse",
					error: true,
					details: data.data.details
				});
			}

			this.clearGet(getId);
		}
	}

	clearGet (getId: number) {
		if (this.waitingGets[getId]) {
			clearTimeout(this.waitingGets[getId].timeout);

			delete this.waitingGets[getId];
		}
	}
}