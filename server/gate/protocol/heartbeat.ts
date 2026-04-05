import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

function sendHeartbeat (this: NodeConnection) {
	this.callMethod("sendEvent", {
		command: "heartbeat",
		data: { uuid: this.selfInfo.uuid, ref_uuid: this.ref_uuid, title: this.selfInfo.title, description: this.selfInfo.description }
	});
}

function receiveHearbeat (this: NodeConnection, data: EventData) {
	this.chain(this.address!.parent, {
		command: "checkNodeRegistered",
		data: data.data
	}, (response: Event) => {
		if (response.data.error || this.normalizedIP !== response.data.data.ip) {
			Log.info(`Node ${data.data.uuid} is not recognised (handshake not completed or changed IP). Redo handshake`, 0);
			this.callMethod("forceClose");
		} else {
			this.uuid = data.data.uuid;
			this.keepAlive = data.data.direct === 1;
			this.callMethod("refresh");

			this.callMethod("sendEvent", {
				command: "heartbeatResponse",
				data: { title: this.selfInfo.title, description: this.selfInfo.description }
			});

			Log.info(`Node ${this.uuid} connected`, 0);
			
			this.send(this.address!.parent, {
				command: "nodeOnline",
				data: { id: this.id, uuid: this.uuid! }
			});
			this.callRoute("nodeInfoChanged", data);

			this.callMethod("ping");
		}
	})
}

function receiveHeartbeatResponse (this: NodeConnection, data: EventData) {
	if (!this.is_outcoming_connection) {
		this.callMethod("forceClose");
		return;
	}

	this.send(this.address!.parent, {
		command: "nodeOnline",
		data: { id: this.id, uuid: this.uuid! }
	});
	this.callRoute("nodeInfoChanged", data);

	Log.info(`Node ${this.uuid} connected`, 0);

	this.callMethod("refresh");

	this.callMethod("ping");
}

export default function setup (node: NodeConnection) {
	node.registerMethod("sendHeartbeat", sendHeartbeat);
	node.registerRoute("heartbeat", receiveHearbeat);
	node.registerRoute("heartbeatResponse", receiveHeartbeatResponse);
}