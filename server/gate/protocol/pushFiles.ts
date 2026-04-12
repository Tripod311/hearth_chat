import FS from "fs"
import crypto from "crypto"
import { Log } from "@tripod311/dispatch"
import type { EventData, Event } from "@tripod311/dispatch"
import { StreamingMultipartFile } from "@tripod311/currents"
import type NodeConnection from "../nodeConnection.js"
import { waitFileSize } from "../utils.js"

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

		const stat = await waitFileSize(baseFile.tmpLink);
		const size = stat.size;
		const fd = await FS.promises.open(baseFile.tmpLink, 'r');

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
	const buffers = this.getVariable("pushBuffers");

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

	for (const [ pushId, files ] of buffers.entries()) {
		this.callMethod("sendEvent", {
			command: "pushFilesResponse",
			data: {
				ok: false,
				pushId: pushId,
				details: "Shutdown"
			}
		})

		for (const f of files) {
			f.stream.destroy();
			await FS.promises.rm(`./data/files/${f.name}`, { force: true });
		}
	}
}

async function clearBuffer (this: NodeConnection, pushId: string) {
	const buffers = this.getVariable("pushBuffers");
	const buf = buffers.get(pushId);

	if (buf) {
		for (const file of buf) {
			file.stream.destroy();
			await FS.promises.rm(`./data/files/${file.name}`, { force: true });
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

	let fName = crypto.randomUUID();
	if (data.data.ext) fName += `.${data.data.ext}`;

	try {
		files.push({
			name: fName,
			stream: FS.createWriteStream(`./data/files/${fName}`)
		});
	} catch (err: any) {
		this.callMethod("sendEvent", {
			command: "pushFilesResponse",
			error: false,
			data: { ok: false, pushId: data.data.pushId, details: err.toString() }
		});

		this.callMethod("clearBuffer", data.data.pushId);
	}
}

function receiveChunk (this: NodeConnection, data: EventData) {
	const buffers = this.getVariable("pushBuffers");
	const files = buffers.get(data.data.pushId);
	if (files) {
		const file = files[files.length - 1];

		file.stream.write(data.data.chunk);
	}
}

async function pushEnd (this: NodeConnection, data: EventData) {
	try {
		const buffers = this.getVariable("pushBuffers");
		const files = buffers.get(data.data.pushId);

		if (!files) throw new Error("Push not found");

		const savedNames: string[] = [];

		for (const file of files) {
			file.stream.end();
			savedNames.push(file.name);
		}

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

		buffers.delete(data.data.pushId);
	} catch (err: any) {
		this.callMethod("clearBuffer", data.data.pushId);

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
	node.registerMethod("clearBuffer", clearBuffer);

	node.registerRoute("pushFilesResponse", pushFilesResponse);
	node.registerRoute("pushStart", pushStart);
	node.registerRoute("pushFile", receiveFile);
	node.registerRoute("pushChunk", receiveChunk);
	node.registerRoute("pushEnd", pushEnd);
	node.registerRoute("pushCancel", pushCancel);

	node.registerFinisher(clearAllPushes);
}