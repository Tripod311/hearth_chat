import FS from "fs"
import crypto from "crypto"
import { Log } from "@tripod311/dispatch"
import type { EventData, Event } from "@tripod311/dispatch"
import { StreamingMultipartFile } from "@tripod311/currents"
import type NodeConnection from "../nodeConnection.js"

const CHUNK_SIZE = 64 * 1024;

interface FileHandle {
	chunks: number;
	chunkIndex: number;
	file: FS.promises.FileHandle;
	ext: string;
}

interface PushRequest {
	baseEvent: Event;
	baseFiles: StreamingMultipartFile[];
	responseNames: string[];
	fileIndex: number;
	handle?: FileHandle;
	completed: boolean;
}

function pushFiles (this: NodeConnection, event: Event) {
	const pushId = this.getVariable("pushCounter");
	this.setVariable("pushCounter", pushId + 1);

	const waiting = this.getVariable("waitingPushes");
	const pushData = {
		baseEvent: event,
		baseFiles: event.data.data.files,
		responseNames: [],
		fileIndex: 0,
		completed: false
	};
	waiting.set(pushId, pushData);

	this.callMethod("sendEvent", {
		command: "pushStart",
		data: {
			pushId: pushId
		}
	});

	this.callMethod("pushFile", pushId);
}

async function pushFile (this: NodeConnection, pushId: number) {
	const waiting = this.getVariable("waitingPushes");
	const pushData = waiting.get(pushId);

	if (!pushData) return;

	if (pushData.fileIndex === pushData.baseFiles.length) {
		pushData.completed = true;
		this.callMethod("sendEvent", {
			command: "pushEnd",
			data: {
				pushId: pushId
			}
		});
		return;
	}

	try {
		const baseFile = pushData.baseFiles[pushData.fileIndex];

		let ext: string = "";
		if (baseFile.originalFileName.indexOf('.') !== -1) {
			const sp = baseFile.originalFileName.split('.');
			ext = sp[sp.length-1];
		}

		const stat = FS.statSync(baseFile.tmpLink)
		const size = stat.size;
		const fd = await FS.promises.open(baseFile.tmpLink, 'r');

		if (size === 0) {
			debugger;
			throw new Error("Invalid file size");
		}

		const handle: FileHandle = {
			file: fd,
			ext: ext,
			chunks: 0,
			chunkIndex: 0
		}

		let offset = 0;
		while (offset < size) {
			handle.chunks++;
			offset += CHUNK_SIZE;
		}

		pushData.handle = handle;

		this.callMethod("sendEvent", {
			command: "pushFile",
			data: {
				pushId: pushId,
				ext: ext
			}
		});

		this.callMethod("pushChunk", pushId);
	} catch (err: any) {
		pushData.baseEvent.response({
			command: "pushFilesResponse",
			error: true,
			details: err.toString()
		});
		this.callMethod("clearPush", pushId);
	}
}

async function pushChunk (this: NodeConnection, pushId: number) {
	const waiting = this.getVariable("waitingPushes");
	const pushData = waiting.get(pushId);

	if (!pushData) return;

	const handle = pushData.handle as FileHandle;

	try {
		const chunk = Buffer.alloc(CHUNK_SIZE);

		await handle.file.read(chunk, 0, CHUNK_SIZE, handle.chunkIndex * CHUNK_SIZE);
		handle.chunkIndex++;

		this.callMethod("sendEvent", {
			command: "pushChunk",
			data: {
				pushId: pushId,
				fileIndex: pushData.fileIndex,
				chunk: chunk,
				isFinal: handle.chunkIndex === handle.chunks
			}
		});

		if (handle.chunkIndex === handle.chunks) {
			await handle.file.close();
			pushData.fileIndex++;

			this.callMethod("pushFile", pushId);
		} else {
			this.callMethod("pushChunk", pushId);
		}
	} catch (err: any) {
		pushData.baseEvent.response({
			command: "pushFilesResponse",
			error: true,
			details: err.toString()
		});
		this.callMethod("clearPush", pushId);
	}
}

async function clearPush (this: NodeConnection, pushId: number) {
	const waiting = this.getVariable("waitingPushes");
	const pushData = waiting.get(pushId);

	if (pushData) {
		waiting.delete(pushId);

		if (!pushData.completed) {
			this.callMethod("sendEvent", {
				command: "pushCancel",
				data: {
					pushId: pushId
				}
			});
		}

		await pushData.handle?.file.close();

		for (const file of pushData.baseFiles) {
			await file.clear();
		}
	}
}

async function clearAllPushes (this: NodeConnection) {
	const waiting = this.getVariable("waitingPushes");

	for (const [pushId, pushData] of waiting.entries()) {
		waiting.delete(pushId);
		
		pushData.baseEvent.response({
			command: "pushFilesResponse",
			error: true,
			details: "Shutdown"
		});

		await pushData.handle?.file.close();

		this.callMethod("sendEvent", {
			command: "pushCancel",
			data: {
				pushId: pushId
			}
		});

		for (const file of pushData.baseFiles) {
			await file.clear();
		}
	}
}

function pushFilesResponse (this: NodeConnection, data: EventData) {
	const pushId = data.data.pushId;
	const waiting = this.getVariable("waitingPushes");
	const pushData = waiting.get(data.data.pushId);

	if (pushData) {
		if (data.data.ok) {
			pushData.baseEvent.response({
				command: "pushFilesResponse",
				error: false,
				data: data.data.names
			});
		} else {
			pushData.baseEvent.response({
				command: "pushFilesResponse",
				error: true,
				data: data.data.details
			});
		}
		this.callMethod("clearPush", pushId);
	}
}

function pushStart (this: NodeConnection, data: EventData) {
	const buffers = this.getVariable("pushBuffers");
	buffers.set(data.data.pushId, []);
}

function receiveFile (this: NodeConnection, data: EventData) {
	const buffers = this.getVariable("pushBuffers");
	const files = buffers.get(data.data.pushId);
	files.push({
		chunks: [],
		ext: data.data.ext
	});
}

function receiveChunk (this: NodeConnection, data: EventData) {
	const buffers = this.getVariable("pushBuffers");
	const files = buffers.get(data.data.pushId);
	const file = files[files.length - 1];

	file.chunks.push(data.data.chunk);
}

async function pushEnd (this: NodeConnection, data: EventData) {
	const buffers = this.getVariable("pushBuffers");
	const files = buffers.get(data.data.pushId);

	let err: any = null;
	const savedNames: string[] = [];

	for (const file of files) {
		let fName = crypto.randomUUID();
		if (file.ext) fName += '.' + file.ext;

		const fullName = `./data/files/${fName}`;

		try {
			await FS.promises.writeFile(fullName, Buffer.concat(file.chunks));
			savedNames.push(fName);
		} catch (fErr: any) {
			err = fErr;
			break;
		}
	}

	if (!err) {
		const trackerAddr = this.address!.parent.parent.data;
		trackerAddr.push("uploadsTracker");

		this.send(trackerAddr, {
			command: "remember",
			data: { files: savedNames }
		});

		this.callMethod("sendEvent", {
			command: "pushFilesResponse",
			error: false,
			data: { ok: true, pushId: data.data.pushId, names: savedNames }
		});
	} else {
		for (const fName in savedNames) {
			const fullName = `./data/files/${fName}`;

			await FS.promises.rm(fullName, { force: true });
		}

		this.callMethod("sendEvent", {
			command: "pushFilesResponse",
			error: false,
			data: { ok: false, pushId: data.data.pushId, details: err.toString() }
		});
	}
}

function pushCancel (this: NodeConnection, data: EventData) {
	const buffers = this.getVariable("pushBuffers");
	buffers.delete(data.data.pushId);
}

export default function setup (node: NodeConnection) {
	node.setVariable("pushCounter", 0);
	node.setVariable("waitingPushes", new Map());
	node.setVariable("pushBuffers", new Map());

	node.registerMethod("pushFiles", pushFiles);
	node.registerMethod("pushFile", pushFile);
	node.registerMethod("pushChunk", pushChunk);
	node.registerMethod("clearPush", clearPush);

	node.registerRoute("pushFilesResponse", pushFilesResponse);
	node.registerRoute("pushStart", pushStart);
	node.registerRoute("pushFile", receiveFile);
	node.registerRoute("pushChunk", receiveChunk);
	node.registerRoute("pushEnd", pushEnd);
	node.registerRoute("pushCancel", pushCancel);

	node.registerFinisher(clearAllPushes);
}