import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

function sendFetchTopics (this: NodeConnection, event: Event) {
	this.callMethod("refresh");

	const topicsEvents = this.getVariable("topicsEvents");

	topicsEvents.add(event);

	if (topicsEvents.size === 1) {
		this.callMethod("sendEvent", {
			command: "fetchTopics"
		})
	}
}

function receiveFetchTopics (this: NodeConnection) {
	if (!this.uuid) return;
	
	this.callMethod("refresh");

	const dbAddress = this.address!.parent.parent.data;
	dbAddress.push("db");

	this.chain(dbAddress, {
		command: "getAllTopics",
		data: {}
	}, (response: Event) => {
		this.callMethod("sendEvent", {
			command: "fetchTopicsResponse",
			error: response.data.error,
			data: response.data.data
		})
	});
}

function receiveFetchTopicsResponse (this: NodeConnection, data: EventData) {
	this.callMethod("refresh");

	const topicsEvents = this.getVariable("topicsEvents");

	for (const ev of topicsEvents) {
		ev.response({
			command: "fetchTopicsResponse",
			error: data.error,
			details: data.details,
			data: data.data
		})
	}

	topicsEvents.clear();
}

function resetTopics (this: NodeConnection) {
	const topicsEvents = this.getVariable("topicsEvents");

	for (const ev of topicsEvents) {
		ev.response({
			command: "fetchTopicsResponse",
			error: true,
			details: "Node disconnected"
		})
	}
}

export default function setup (node: NodeConnection) {
	node.setVariable("topicsEvents", new Set());
	node.registerMethod("fetchTopics", sendFetchTopics);
	node.registerRoute("fetchTopics", receiveFetchTopics);
	node.registerRoute("fetchTopicsResponse", receiveFetchTopicsResponse);
	node.registerFinisher(resetTopics);
}