import Net from "net"
import { Node, Dispatcher, Address, Event, Log, StreamProcessor, SerializeEvent } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type { NodeInfo } from "./gate.js"

import ActorProxy from "./actorProxy.js"

const NODE_KEEPALIVE = 1000 * 60 * 10;

export default class NodeConnection extends Node {
	public id: string;
	public selfInfo: NodeInfo;
	public uuid?: string;
	private keepAlive: boolean = false;
	private socket: Net.Socket;
	private processor!: StreamProcessor;

	private waitingTitle: Event[] = [];
	private waitingTopics: Event[] = [];
	private waitingRelated: Event[] = [];

	private counter: number = 0;
	private proxies: Record<number, ActorProxy> = {};

	private timeout?: ReturnType<typeof setTimeout>;

	constructor (id: string, socket: Net.Socket, selfInfo: NodeInfo, uuid?: string, keepAlive: boolean = false) {
		super();

		this.id = id;
		this.selfInfo = selfInfo;

		this.uuid = uuid;
		this.keepAlive = keepAlive

		this.socket = socket;

		this.socket.on("end", this.socketDisconnected.bind(this));
		this.socket.on("close", this.socketDisconnected.bind(this));
		this.socket.on("error", this.socketDisconnected.bind(this));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.processor = new StreamProcessor(dispatcher, this.socket);
		this.processor.on("message", this.processMessage.bind(this));

		if (this.uuid) {
			this.sendHeartbeat();
		}
	}

	detach () {
		Log.info(`Node ${this.uuid} disconnected`, 0);
		clearTimeout(this.timeout);

		for (const ev of this.waitingTitle) {
			ev.response({
				command: "fetchTitleResponse",
				error: true,
				details: "Node disconnected"
			})
		}

		for (const ev of this.waitingTopics) {
			ev.response({
				command: "fetchTopicsResponse",
				error: true,
				details: "Node disconnected"
			})
		}

		for (const ev of this.waitingRelated) {
			ev.response({
				command: "fetchRelatedResponse",
				error: true,
				details: "Node disconnected"
			})
		}

		this.socket.destroy();

		super.detach();
	}

	get normalizedIP (): string {
		const ip = this.socket.remoteAddress as string;

		return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
	}

	processMessage (event: Event) {
		switch (event.data.command) {
			case "heartbeat":
				this.processHeartbeat(event.data.data);
				break;
			case "heartbeatResponse":
				this.processHeartbeatResponse(event.data.data);
				break;
			case "askRequest":
				this.askRequest(event.data.data);
				break;
			case "askResponse":
				this.askResponse(event.data.data);
				break;
			case "nodeInfoChanged":
				this.processNodeInfoChanged(event.data.data);
				break;
			case "fetchTitle":
				this.processFetchTitle();
				break;
			case "fetchTopics":
				this.processFetchTopics();
				break;
			case "fetchRelated":
				this.processFetchRelated();
				break;
			case "fetchTitleResponse":
				this.fetchTitleResponse(event.data);
				break;
			case "fetchTopicsResponse":
				this.fetchTopicsdResponse(event.data);
				break;
			case "fetchRelatedResponse":
				this.fetchRelatedResponse(event.data);
				break;
			case "proxyEvent":
				this.processProxyEvent(event.data);
				break;
		}
	}

	socketDisconnected () {
		if (this.address) {
			this.send(this.address!.parent, {
				command: "socketDisconnected",
				data: {
					id: this.id
				}
			});
		}
	}

	sendEvent (data: EventData) {
		const ev = new Event(
			this.dispatcher!,
			new Address([]),
			new Address([]),
			data
		);
		const buf = SerializeEvent(ev);

		this.socket.write(buf);
	}

	sendHeartbeat () {
		this.sendEvent({
			command: "heartbeat",
			data: { uuid: this.selfInfo.uuid, title: this.selfInfo.title, description: this.selfInfo.description }
		});
	}

	processHeartbeat (data: { uuid: string; title: string; description: string; }) {
		this.chain(this.address!.parent, {
			command: "checkNodeRegistered",
			data: data
		}, (response: Event) => {
			if (response.data.error || this.normalizedIP !== response.data.data.ip) {
				Log.info(`Node ${data.uuid} is not recognised (handshake not completed or changed IP). Complete handshake`, 0);
				this.socketDisconnected();
			} else {
				this.uuid = data.uuid;

				this.sendEvent({
					command: "heartbeatResponse",
					data: { title: this.selfInfo.title, description: this.selfInfo.description }
				});

				this.processHeartbeatResponse({ title: data.title, description: data.description });
			}
		})
	}

	processHeartbeatResponse (data: { title: string; description: string }) {
		if (this.uuid) {
			this.send(this.address!.parent, {
				command: "nodeOnline",
				data: { uuid: this.uuid! }
			});
			this.processNodeInfoChanged(data);

			Log.info(`Node ${this.uuid} connected`, 0);

			if (!this.keepAlive) {
				this.timeout = setTimeout(this.timeoutShutdown.bind(this), NODE_KEEPALIVE);
			}
		} else {
			this.socket.destroy();
		}
	}

	ask (uuid: string) {
		this.refresh();
		this.sendEvent({
			command: "ask",
			data: { uuid }
		});
	}

	askRequest (data: { uuid: string }) {
		this.refresh();
		this.chain(this.address!.parent, {
			command: "checkNodeRegistered",
			data: data
		}, (response: Event) => {
			if (response.data.error) {
				this.sendEvent({
					command: "askResponse",
					data: { ok: false, uuid: data.uuid }
				});
			} else {
				this.sendEvent({
					command: "askResponse",
					data: { ok: true, uuid: data.uuid, ip: response.data.data.ip, port: response.data.data.port }
				})
			}
		})
	}

	askResponse (data: { ok: boolean; uuid: string; ip?: string; port?: string; }) {
		this.refresh();
		this.send(this.address!.parent, {
			command: "askResponse",
			data: data
		});
	}

	sendNodeInfoChanged (data: { title: string; description: string; }) {
		this.refresh();
		this.sendEvent({
			command: "nodeInfoChanged",
			data: data
		});
	}

	processNodeInfoChanged (data: { title: string; description: string; }) {
		this.refresh();
		if (this.uuid) {
			const dbAddress = this.address!.parent.parent.data;
			dbAddress.push("db");

			this.send(dbAddress, {
				command: "relatedNodeInfoUpdate",
				data: {
					uuid: this.uuid,
					title: data.title,
					description: data.description
				}
			});
		}
	}

	timeoutShutdown () {
		this.socket.destroy();
	}

	refresh () {
		if (!this.keepAlive) {
			clearTimeout(this.timeout);
			this.timeout = setTimeout(this.timeoutShutdown.bind(this), NODE_KEEPALIVE);
		}
	}

	sendFetchTitle (event: Event) {
		this.refresh();

		if (this.waitingTitle.length === 0) {
			this.sendEvent({
				command: "fetchTitle",
				data: {}
			});
		}

		this.waitingTitle.push(event);
	}

	sendFetchTopics (event: Event) {
		this.refresh();

		if (this.waitingTopics.length === 0) {
			this.sendEvent({
				command: "fetchTopics",
				data: {}
			});
		}

		this.waitingTopics.push(event);
	}

	sendFetchRelated (event: Event) {
		this.refresh();

		if (this.waitingRelated.length === 0) {
			this.sendEvent({
				command: "fetchRelated",
				data: {}
			});
		}

		this.waitingRelated.push(event);
	}

	processFetchTitle () {
		this.refresh();

		const dbAddress = this.address!.parent.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "fetchTitle",
			data: {}
		}, (response: Event) => {
			this.sendEvent({
				command: "fetchTitleResponse",
				error: response.data.error,
				data: response.data.data
			})
		});
	}

	processFetchTopics () {
		this.refresh();

		const dbAddress = this.address!.parent.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "getAllTopics",
			data: {}
		}, (response: Event) => {
			this.sendEvent({
				command: "fetchTopicsResponse",
				error: response.data.error,
				data: response.data.data
			})
		});
	}

	processFetchRelated () {
		this.refresh();

		const dbAddress = this.address!.parent.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "fetchDirectNodes",
			data: {}
		}, (response: Event) => {
			this.sendEvent({
				command: "fetchRelatedResponse",
				error: response.data.error,
				data: response.data.data
			})
		});
	}

	fetchTitleResponse (data: EventData) {
		this.refresh();

		for (const ev of this.waitingTitle) {
			ev.response(data);
		}

		this.waitingTitle.length = 0;
	}

	fetchTopicsdResponse (data: EventData) {
		this.refresh();

		for (const ev of this.waitingTopics) {
			ev.response(data);
		}

		this.waitingTopics.length = 0;
	}

	fetchRelatedResponse (data: EventData) {
		this.refresh();

		for (const ev of this.waitingRelated) {
			ev.response(data);
		}

		this.waitingRelated.length = 0;
	}

	connectProxy (proxy: ActorProxy) {
		const id = this.counter++;

		this.proxies[id] = proxy;
		proxy.setLocalId(id);

		proxy.on("event", this.proxyEvent.bind(this));
		proxy.on("destroy", this.proxyDestroy.bind(this, id));

		proxy.kickstart();
	}

	proxyEvent (data: EventData) {
		this.sendEvent({
			command: "proxyEvent",
			data: data
		});
	}

	proxyDestroy (id: number) {
		if (this.proxies[id]) {
			this.proxies[id].kill();
			delete this.proxies[id];
		}
	}

	processProxyEvent (data: EventData) {
		
	}
}