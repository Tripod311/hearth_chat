import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

function sendGetActorInfo (this: NodeConnection, event: Event) {
	this.callMethod("refresh");

	const getActorInfoEvents = this.getVariable("actorInfoEvents");

	let arr: Event[];

	if (!getActorInfoEvents.has(event.data.data.id)) {
		arr = [];
		getActorInfoEvents.set(event.data.data.id, arr);
	} else {
		arr = getActorInfoEvents.get(event.data.data.id) as Event[];
	}

	arr.push(event);

	if (arr.length === 1) {
		this.callMethod("sendEvent", {
			command: "getActorInfo",
			data: event.data.data
		})
	}
}

function receiveGetActorInfo (this: NodeConnection, data: EventData) {
	if (!this.uuid) return;
	
	this.callMethod("refresh");

	const dbAddress = this.address!.parent.parent.data;
	dbAddress.push("db");

	this.chain(dbAddress, {
		command: "getActorInfo",
		data: data.data
	}, (response: Event) => {
		this.callMethod("sendEvent", {
			command: "getActorInfoResponse",
			error: response.data.error,
			data: response.data.data
		})
	});
}

function receiveGetActorInfoResponse (this: NodeConnection, data: EventData) {
	this.callMethod("refresh");

	const getActorInfoEvents = this.getVariable("actorInfoEvents");
	const arr = getActorInfoEvents.get(data.data.id);

	if (arr) {
		for (const ev of arr) {
			ev.response({
				command: "getActorInfoResponse",
				error: data.error,
				details: data.details,
				data: data.data
			})
		}
	}

	getActorInfoEvents.delete(data.data.id);
}

function resetGetActorInfo (this: NodeConnection) {
	const getActorInfoEvents = this.getVariable("actorInfoEvents");

	for (const [id, arr] of getActorInfoEvents) {
		for (const ev of arr) {
			ev.response({
				command: "getActorInfoResponse",
				error: true,
				details: "Node disconnected"
			})
		}
	}
}

export default function setup (node: NodeConnection) {
	node.setVariable("actorInfoEvents", new Map());
	node.registerMethod("getActorInfo", sendGetActorInfo);
	node.registerRoute("getActorInfo", receiveGetActorInfo);
	node.registerRoute("getActorInfoResponse", receiveGetActorInfoResponse);
	node.registerFinisher(resetGetActorInfo);
}