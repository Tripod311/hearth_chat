import { WebSocket } from "ws"
import { Log, Event } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type NodeConnection from "../nodeConnection.js"

import LocalProxy from "../proxies/localProxy.js"
import RemoteProxy from "../proxies/remoteProxy.js"

interface LocalProxyData {
	socket: WebSocket;
	topic_id: number;
	node_user_id: number;
	display_name: string;
}

function createLocalProxy (this: NodeConnection, data: LocalProxyData) {
	this.callMethod("suspend");

	const id = this.getVariable("proxyCounter");
	this.setVariable("proxyCounter", id + 1);

	const proxy = new LocalProxy(data.socket, id, data.topic_id, data.node_user_id, data.display_name);

	proxy.on("forward", (message: string) => {
		this.callMethod("sendProxyEvent", {
			id: id,
			message: message
		});
	});
	proxy.on("destroy", () => {
		this.callMethod("destroyProxy", id)
	});

	const proxies = this.getVariable("proxies");
	proxies.set(id, proxy);

	this.callMethod("sendEvent", {
		command: "createRemoteProxy",
		data: {
			id: id,
			node_user_id: proxy.node_user_id,
			display_name: proxy.display_name,
			topic_id: proxy.topic_id
		}
	});
}

function createRemoteProxy (this: NodeConnection, data: EventData) {
	this.callMethod("suspend");

	const dbAddr = this.address!.parent.parent.data;
	dbAddr.push("db");

	this.chain(dbAddr, {
		command: "updateActor",
		data: {
			node_id: this.uuid!,
			node_user_id: data.data.node_user_id,
			display_name: data.data.display_name
		}
	}, (response: Event) => {
		if (response.data.error) {
			this.callMethod("sendEvent", {
				command: "createProxyResponse",
				data: { ok: false, id: data.data.id }
			});
		} else {
			const id = this.getVariable("proxyCounter");
			this.setVariable("proxyCounter", id + 1);

			const proxy = new RemoteProxy(id, data.data.topic_id, data.data.node_user_id, data.data.display_name);

			proxy.on("forward", (message: string) => {
				this.callMethod("sendProxyEvent", {
					id: id,
					message: message
				});
			});
			proxy.on("destroy", () => {
				this.callMethod("destroyProxy", id)
			});

			const proxies = this.getVariable("proxies");
			proxies.set(id, proxy);

			// forward proxy to topic
			const managerAddr = this.address!.parent.parent.data;
			managerAddr.push("topics");

			this.chain(managerAddr, {
				command: "proxyConnection",
				data: {
					proxy: proxy,
					actor_id: response.data.data.id,
					node_id: this.uuid!,
					topic_id: proxy.topic_id,
				}
			}, (tResponse: Event) => {
				if (tResponse.data.error) {
					this.callMethod("sendEvent", {
						command: "createProxyResponse",
						data: { ok: false, id: data.data.id }
					});
					this.callMethod("destroyProxy", id);
				} else {
					this.callMethod("sendEvent", {
						command: "createProxyResponse",
						data: { ok: true, id: data.data.id }
					});
					proxy.ready();
				}
			});
		}
	});
}

function createProxyResponse (this: NodeConnection, data: EventData) {
	const proxies = this.getVariable("proxies");
	const id = data.data.id;

	const proxy = proxies.get(id);

	if (proxy) {
		if (!data.data.ok) {
			this.callMethod("destroyProxy", id);
		} else {
			proxy.ready();
		}
	}
}

function receiveProxyEvent (this: NodeConnection, data: EventData) {
	const proxies = this.getVariable("proxies");
	const id = data.data.id;
	const proxy = proxies.get(id);

	if (proxy) {
		proxy.receive(data.data.message);
	}
}

function sendProxyEvent (this: NodeConnection, data: { id: number; message: string; }) {
	this.callMethod("sendEvent", {
		command: "proxyEvent",
		data: {
			id: data.id,
			message: data.message
		}
	});
}

function destroyProxy (this: NodeConnection, id: number) {
	const proxies = this.getVariable("proxies");

	const proxy = proxies.get(id);

	if (proxy) {
		proxies.delete(id);
		proxy.kill();

		this.callMethod("sendEvent", {
			command: "proxyDown",
			data: {
				node_user_id: proxy.node_user_id
			}
		});
	}

	this.callMethod("refresh");
}

function proxyDown (this: NodeConnection, data: EventData) {
	const proxies = this.getVariable("proxies");

	for (const proxy of proxies.values()) {
		if (proxy.node_user_id === data.data.node_user_id) {
			proxies.delete(proxy.id);
			proxy.kill();
			this.callMethod("refresh");
			return;
		}
	}
}

function killProxies (this: NodeConnection) {
	const proxies = this.getVariable("proxies");

	for (const proxy of proxies.values()) {
		proxy.kill();
	}
}

export default function setup(node: NodeConnection) {
	node.setVariable("proxyCounter", 0);
	node.setVariable("proxies", new Map());

	node.registerMethod("createLocalProxy", createLocalProxy);
	node.registerMethod("destroyProxy", destroyProxy);
	node.registerMethod("sendProxyEvent", sendProxyEvent);

	node.registerRoute("createRemoteProxy", createRemoteProxy);
	node.registerRoute("createProxyResponse", createProxyResponse);
	node.registerRoute("proxyDown", proxyDown);
	node.registerRoute("proxyEvent", receiveProxyEvent);

	node.registerFinisher(killProxies);
}