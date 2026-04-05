import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

function sendFetchRelated (this: NodeConnection, event: Event) {
	this.callMethod("refresh");

	const relatedEvents = this.getVariable("relatedEvents");

	relatedEvents.add(event);

	if (relatedEvents.size === 1) {
		this.callMethod("sendEvent", {
			command: "fetchRelated"
		})
	}
}

function receiveFetchRelated (this: NodeConnection) {
	if (!this.uuid) return;
	
	this.callMethod("refresh");

	const dbAddress = this.address!.parent.parent.data;
	dbAddress.push("db");

	this.chain(dbAddress, {
		command: "fetchDirectNodes",
		data: { hideIp: true }
	}, (response: Event) => {
		this.callMethod("sendEvent", {
			command: "fetchRelatedResponse",
			error: response.data.error,
			data: response.data.data
		})
	});
}

function receiveFetchRelatedResponse (this: NodeConnection, data: EventData) {
	this.callMethod("refresh");

	const relatedEvents = this.getVariable("relatedEvents");

	for (const ev of relatedEvents) {
		ev.response({
			command: "fetchRelatedResponse",
			error: data.error,
			details: data.details,
			data: data.data
		})
	}

	relatedEvents.clear();
}

function resetRelated (this: NodeConnection) {
	const relatedEvents = this.getVariable("relatedEvents");

	for (const ev of relatedEvents) {
		ev.response({
			command: "fetchRelatedResponse",
			error: true,
			details: "Node disconnected"
		})
	}
}

export default function setup (node: NodeConnection) {
	node.setVariable("relatedEvents", new Set());
	node.registerMethod("fetchRelated", sendFetchRelated);
	node.registerRoute("fetchRelated", receiveFetchRelated);
	node.registerRoute("fetchRelatedResponse", receiveFetchRelatedResponse);
	node.registerFinisher(resetRelated);
}