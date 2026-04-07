import FS from "fs"
import path from "path"
import { Log } from "@tripod311/dispatch"
import type { EventData, Event } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

const FILE_TIMEOUT = 1000 * 60 * 5;
const CHUNK_SIZE = 64 * 1024;

interface GetRequest {
	baseEvent: Event;
	chunks: Buffer[];
	timeout: ReturnType<typeof setTimeout>;
}

interface GetBuffer {
	getId: number;
	chunks: number;
	chunkIndex: number;
	file: FS.promises.FileHandle;
}

function getFile (this: NodeConnection, event: Event) {
	const getId = this.getVariable("getCounter");
	this.setVariable("getCounter", getId + 1);

	const waiting = this.getVariable('waitingGets');

	waiting.set(getId, {
		baseEvent: event,
		chunks: [],
		timeout: setTimeout(
			() => {
				event.response({
					command: "getFileResponse",
					error: true,
					details: "Timeout"
				});
				waiting.delete(getId)
			},
			FILE_TIMEOUT
		)
	});

	this.callMethod("sendEvent", {
		command: "getFile",
		data: {
			getId: getId,
			name: event.data.data.name
		}
	});
}

function getFileResponse (this: NodeConnection, data: EventData) {
	const waiting = this.getVariable('waitingGets');
	const getId = data.data.getId;
	const getData = waiting.get(getId);

	if (getData) {
		if (data.data.ok) {
			getData.chunks.push(data.data.chunk);

			if (data.data.isFinal) {
				clearTimeout(getData.timeout);

				getData.baseEvent.response({
					command: "getFileResponse",
					error: false,
					data: { content: new Uint8Array(Buffer.concat(getData.chunks)) }
				});
				waiting.delete(getId);
			}
		} else {
			clearTimeout(getData.timeout);

			getData.baseEvent.response({
				command: "getFileResponse",
				error: true,
				details: data.details
			});
			waiting.delete(getId);
		}
	}
}

async function receiveGetFile (this: NodeConnection, data: EventData) {
	const getId = data.data.getId;
	const fName = data.data.name;

	try {
		const dirPath = `${process.cwd()}/data/files`;
		const fullPath = path.resolve(dirPath, fName);

		// serve files only from files directory
		if (!fullPath.startsWith(dirPath)) {
			throw new Error("Invalid path");
		}

		const stat = FS.statSync(fullPath);
		const size = stat.size;

		if (size === 0) throw new Error("Invalid file size")

		const buf: GetBuffer = {
			getId: getId,
			chunks: 0,
			chunkIndex: 0,
			file: await FS.promises.open(fullPath, 'r')
		}

		const buffers = this.getVariable("waitingBuffers");

		let index = 0;
		while (index < size) {
			buf.chunks++;
			index += CHUNK_SIZE;
		}

		buffers.set(getId, buf);

		this.callMethod("nextChunk", getId);
	} catch (err: any) {
		this.callMethod("sendEvent", {
			command: "getFileResponse",
			data: {
				ok: false,
				getId: getId,
				details: err.toString()
			}
		});
	}
}

async function nextChunk (this: NodeConnection, getId: number) {
	try {
		const buffers = this.getVariable("waitingBuffers");
		const buf = buffers.get(getId);

		const chunk = Buffer.alloc(CHUNK_SIZE);

		await buf.file.read(chunk, 0, CHUNK_SIZE, buf.chunkIndex * CHUNK_SIZE);
		buf.chunkIndex++;

		this.callMethod("sendEvent", {
			command: "getFileResponse",
			data: {
				getId: getId,
				ok: true,
				chunk: chunk,
				isFinal: buf.chunkIndex === buf.chunks
			}
		});

		if (buf.chunkIndex === buf.chunks) {
			this.callMethod("clearBuffer", getId);	
		} else {
			this.callMethod("nextChunk", getId);
		}
	} catch (err: any) {
		this.callMethod("sendEvent", {
			command: "getFileResponse",
			data: {
				getId: getId,
				ok: false,
				details: err.toString()
			}
		});
		this.callMethod("clearBuffer", getId);
	}
}

async function clearBuffer (this: NodeConnection, getId: number) {
	const buffers = this.getVariable("waitingBuffers");
	const buf = buffers.get(getId);

	if (buf) {
		await buf.file.close();
		buffers.delete(getId);
	}
}

async function clearAllGets (this: NodeConnection) {
	const waiting = this.getVariable('waitingGets');
	const buffers = this.getVariable("waitingBuffers");

	for (const getData of waiting.values()) {
		clearTimeout(getData.timeout);
		getData.baseEvent.response({
			command: "getFileResponse",
			error: true,
			details: "Shutdown"
		});
	}

	for (const [getId, buf] of buffers.entries()) {
		this.callMethod("sendEvent", {
			command: "getFileResponse",
			data: {
				getId: getId,
				ok: false,
				details: "Shutdown"
			}
		});
		await buf.file.close();
	}

	waiting.clear();
	buffers.clear();
}

export default function setup (node: NodeConnection) {
	node.setVariable("getCounter", 0);
	node.setVariable("waitingGets", new Map());
	node.setVariable("waitingBuffers", new Map());

	node.registerMethod("getFile", getFile);
	node.registerMethod("nextChunk", nextChunk);
	node.registerMethod("clearBuffer", clearBuffer);

	node.registerRoute("getFile", receiveGetFile);
	node.registerRoute("getFileResponse", getFileResponse);

	node.registerFinisher(clearAllGets);
}