import FS from "fs"
import crypto from "crypto"
import { Log } from "@tripod311/dispatch"
import type { EventData, Event } from "@tripod311/dispatch"
import { StreamingMultipartFile } from "@tripod311/currents"
import type NodeConnection from "../nodeConnection.js"

const FILE_TIMEOUT = 1000 * 60 * 5;

interface PushRequest {
	baseEvent: Event;
	baseFiles: StreamingMultipartFile[];
	responseNames: string[];
	pendingId: number;
	timeout?: ReturnType<typeof setTimeout>;
}

function pushFiles (this: NodeConnection, event: Event) {
	const id = this.getVariable("pushCounter");
	this.setVariable("pushCounter", id + 1);

	const waiting = this.getVariable("waitingPushes");
	const pushData = {
		baseEvent: event,
		baseFiles: event.data.data.files,
		responseNames: [],
		pendingId: 0
	};
	waiting.set(id, pushData);

	this.callMethod("pushFile", id);
}

function pushFile (this: NodeConnection, pushId: number) {
	const waiting = this.getVariable("waitingPushes");
	const pushData = waiting.get(pushId);

	if (pushData.pendingId === pushData.baseFiles.length) {
		pushData.baseEvent.response({
			command: "pushFilesResponse",
			error: false,
			data: pushData.responseNames
		});
		this.callMethod("clearPush", pushId);
		return;
	}

	pushData.timeout = setTimeout(
		() => {
			pushData.baseEvent.response({
				command: "pushFilesResponse",
				error: true,
				details: "Timed out"
			});
			this.callMethod("clearPush", pushId);
		},
		FILE_TIMEOUT
	);

	const file = pushData.baseFiles[pushData.pendingId];

	FS.readFile(file.tmpLink, (err: any, content: Buffer) => {
		if (err) {
			pushData.baseEvent.response({
				command: "pushFilesResponse",
				error: true,
				details: err.toString()
			});
			this.callMethod("clearPush", pushId);
		} else {
			let ext: string = "";
			if (file.originalFileName.indexOf('.') !== -1) {
				const sp = file.originalFileName.split('.');
				ext = sp[sp.length-1];
			}

			const toSend = new Uint8Array(content);

			this.callMethod("sendEvent", {
				command: "pushFile",
				data: {
					pushId: pushId,
					ext: ext,
					content: toSend
				}
			});
		}
	});
}

function pushFileResponse (this: NodeConnection, data: EventData) {
	const waiting = this.getVariable("waitingPushes");
	const pushId = data.data.pushId;
	const pushData = waiting.get(pushId);

	if (pushData) {
		clearTimeout(pushData.timeout);

		if (!data.data.ok) {
			pushData.baseEvent.response({
				command: "pushFilesResponse",
				error: true,
				details: data.details
			});
			this.callMethod("clearPush", pushId);
		} else {
			pushData.responseNames.push(data.data.name);
			pushData.pendingId++;
			this.callMethod("pushFile", pushId);
		}
	}
}

async function clearPush (this: NodeConnection, pushId: number) {
	const waiting = this.getVariable("waitingPushes");
	const pushData = waiting.get(pushId);

	if (pushData) {
		waiting.delete(pushId);

		clearTimeout(pushData.timeout);

		for (const file of pushData.baseFiles) {
			await file.clear();
		}
	}
}

async function receiveFile (this: NodeConnection, data: EventData) {
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

		this.callMethod("sendEvent", {
			command: "pushFileResponse",
			error: false,
			data: { ok: true, pushId: pushId, name: fName }
		});
	} catch (err: any) {
		await FS.promises.rm(fullName, { force: true });

		this.callMethod("sendEvent", {
			command: "pushFileResponse",
			error: false,
			data: { ok: false, details: err.toString() }
		});
	}
}

async function clearAllPushes (this: NodeConnection) {
	const waiting = this.getVariable("waitingPushes");

	for (const [id, pushData] of waiting.entries()) {
		waiting.delete(id);
		
		pushData.baseEvent.response({
			command: "pushFilesResponse",
			error: true,
			details: "Shutdown"
		});

		clearTimeout(pushData.timeout);

		for (const file of pushData.baseFiles) {
			await file.clear();
		}
	}
}

export default function setup (node: NodeConnection) {
	node.setVariable("pushCounter", 0);
	node.setVariable("waitingPushes", new Map());

	node.registerMethod("pushFiles", pushFiles);
	node.registerMethod("pushFile", pushFile);
	node.registerMethod("clearPush", clearPush);

	node.registerRoute("pushFile", receiveFile);
	node.registerRoute("pushFileResponse", pushFileResponse);

	node.registerFinisher(clearAllPushes);
}