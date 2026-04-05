import { Log } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

function sendInfoChanged (this: NodeConnection, data: { title: string; description: string; }) {
	this.callMethod("refresh");

	this.selfInfo.title = data.title;
	this.selfInfo.description = data.description;

	this.callMethod("sendEvent", {
		command: "nodeInfoChanged",
		data: data
	});
}

function receiveInfoChanged (this: NodeConnection, data: EventData) {
	if (!this.uuid) return;

	this.callMethod("refresh");

	const dbAddress = this.address!.parent.parent.data;
	dbAddress.push("db");

	this.send(dbAddress, {
		command: "relatedNodeInfoUpdate",
		data: {
			uuid: this.uuid,
			title: data.data.title,
			description: data.data.description
		}
	});
}

export default function setup (node: NodeConnection) {
	node.registerMethod("sendInfoChanged", sendInfoChanged);
	node.registerRoute("nodeInfoChanged", receiveInfoChanged);
}