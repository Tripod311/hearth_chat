import FS from "fs"
import path from "path"
import { Log } from "@tripod311/dispatch"
import type { EventData, Event } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

const FILE_TIMEOUT = 1000 * 60 * 5;

interface GetRequest {
	baseEvent: Event;
	timeout: ReturnType<typeof setTimeout>;
}

function getFile (this: NodeConnection, event: Event) {
	const getId = this.getVariable("getCounter");
	this.setVariable("getCounter", getId + 1);

	const waiting = this.getVariable('waitingGets');
	waiting.set(getId, {
		baseEvent: event,
		timeout: setTimeout(
			() => {
				this.callMethod("clearGet", getId)
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

		const content = await FS.promises.readFile(fullPath);

		this.callMethod("sendEvent", {
			command: "getFileResponse",
			data: {
				ok: true,
				getId: getId,
				content: new Uint8Array(content)
			}
		});
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

function getFileResponse (this: NodeConnection, data: EventData) {
	const waiting = this.getVariable('waitingGets');
	const getId = data.data.id;
	const getData = waiting.get(getId);

	if (getData) {
		if (data.data.ok) {
			getData.baseEvent.response({
				command: "getFileResponse",
				error: false,
				data: { content: data.data.content }
			});
		} else {
			getData.baseEvent.response({
				command: "getFileResponse",
				error: true,
				details: data.data.details
			});
		}

		waiting.delete(getId);
	}
}

async function clearAllGets (this: NodeConnection) {
	const waiting = this.getVariable('waitingGets');

	for (const getData of waiting.values()) {
		getData.baseEvent.response({
			command: "getFileResponse",
			error: true,
			details: "Shutdown"
		});
	}

	waiting.clear();
}

export default function setup (node: NodeConnection) {
	node.setVariable("getCounter", 0);
	node.setVariable("waitingGets", new Map());

	node.registerMethod("getFile", getFile);

	node.registerRoute("getFile", receiveGetFile);
	node.registerRoute("getFileResponse", getFileResponse);

	node.registerFinisher(clearAllGets);
}