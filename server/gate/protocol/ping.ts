import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

const PING_TIMEOUT = 1000 * 10;

function sendPing (this: NodeConnection) {
	this.setVariable("pingTimeout", setTimeout(() => {
		this.callMethod("forceClose");
	}, PING_TIMEOUT));

	this.callMethod("sendEvent", {
		command: "ping"
	});
}

function receivePing (this: NodeConnection) {
	this.callMethod("sendEvent", {
		command: "pong"
	});
}

function receivePong (this: NodeConnection) {
	clearTimeout(this.getVariable("pingTimeout"));

	this.setVariable("pingTimeout", setTimeout(() => {
		this.callMethod("ping");
	}, PING_TIMEOUT));
}

function clearPing (this: NodeConnection) {
	clearTimeout(this.getVariable("pingTimeout"));
}

export default function setup (node: NodeConnection) {
	node.registerMethod("ping", sendPing);
	node.registerRoute("ping", receivePing);
	node.registerRoute("pong", receivePong);
	node.registerFinisher(clearPing);
}