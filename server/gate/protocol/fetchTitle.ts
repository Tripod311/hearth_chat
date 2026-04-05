import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

function sendFetchTitle (this: NodeConnection, event: Event) {
	this.callMethod("refresh");

	const titleEvents = this.getVariable("titleEvents");

	titleEvents.add(event);

	if (titleEvents.size === 1) {
		this.callMethod("sendEvent", {
			command: "fetchTitle"
		})
	}
}

function receiveFetchTitle (this: NodeConnection) {
	if (!this.uuid) return;
	
	this.callMethod("refresh");

	const dbAddress = this.address!.parent.parent.data;
	dbAddress.push("db");

	this.chain(dbAddress, {
		command: "fetchTitle",
		data: {}
	}, (response: Event) => {
		this.callMethod("sendEvent", {
			command: "fetchTitleResponse",
			error: response.data.error,
			data: response.data.data
		})
	});
}

function receiveFetchTitleResponse (this: NodeConnection, data: EventData) {
	this.callMethod("refresh");

	const titleEvents = this.getVariable("titleEvents");

	for (const ev of titleEvents) {
		ev.response({
			command: "fetchTitleResponse",
			error: data.error,
			details: data.details,
			data: data.data
		})
	}

	titleEvents.clear();
}

function resetTitle (this: NodeConnection) {
	const titleEvents = this.getVariable("titleEvents");

	for (const ev of titleEvents) {
		ev.response({
			command: "fetchTitleResponse",
			error: true,
			details: "Node disconnected"
		})
	}
}

export default function setup (node: NodeConnection) {
	node.setVariable("titleEvents", new Set());
	node.registerMethod("fetchTitle", sendFetchTitle);
	node.registerRoute("fetchTitle", receiveFetchTitle);
	node.registerRoute("fetchTitleResponse", receiveFetchTitleResponse);
	node.registerFinisher(resetTitle);
}