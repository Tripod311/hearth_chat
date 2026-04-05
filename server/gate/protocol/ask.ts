import type { EventData, Event } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

interface AskRequest {
	uuid: string;
	ref_uuid?: string;
}

interface AskResponse {
	ok: boolean;
	uuid: string;
	ip?: string;
	port?: number;
}

function sendAsk (this: NodeConnection, uuid: string) {
	const pending = this.getVariable("askRequests");

	if (!pending.has(uuid)) {
		this.callMethod("refresh");

		pending.add(uuid);

		this.callMethod("sendEvent", {
			command: "ask",
			data: { uuid }
		});
	}
}

function receiveAsk (this: NodeConnection, evData: EventData) {
	if (!this.uuid) return;

	const data = evData.data as AskRequest;

	this.callMethod("refresh");

	this.chain(this.address!.parent, {
		command: "checkNodeRegistered",
		data: data
	}, (response: Event) => {
		if (response.data.error) {
			this.callMethod("sendEvent", {
				command: "askResponse",
				data: { ok: false, uuid: data.uuid }
			});
		} else {
			this.callMethod("sendEvent", {
				command: "askResponse",
				data: { ok: true, uuid: data.uuid, ip: response.data.data.ip, port: response.data.data.port }
			})
		}
	})
}

function receiveAskResponse (this: NodeConnection, evData: EventData) {
	if (!this.uuid) return;

	const data = evData.data as AskResponse;

	const pending = this.getVariable("askRequests");

	if (pending.has(data.uuid)) {
		pending.delete(data.uuid);

		this.callMethod("refresh");
		this.send(this.address!.parent, {
			command: "askResponse",
			data: {
				ref_uuid: this.uuid,
				response: data
			}
		});
	}
}

function resetAsk (this: NodeConnection) {
	const pending = this.getVariable("askRequests");

	for (const uuid of pending) {
		this.callRoute("askResponse", { ok: false, uuid: uuid });
	}
}

export default function setup (node: NodeConnection) {
	node.setVariable("askRequests", new Set());
	node.registerMethod("ask", sendAsk);
	node.registerRoute("ask", receiveAsk);
	node.registerRoute("askResponse", receiveAskResponse);
	node.registerFinisher(resetAsk);
}