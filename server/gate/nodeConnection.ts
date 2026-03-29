import Net from "net"
import { Node, Dispatcher, Address, Event, Log, StreamProcessor, SerializeEvent } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type { NodeInfo } from "./gate.js"

import ActorProxy from "./actorProxy.js"

export default class NodeConnection extends Node {
	public id: string;
	public selfInfo: NodeInfo;
	public uuid?: string;
	private ref_uuid?: string;
	private keepAlive: boolean = false;
	private socket: Net.Socket;
	private processor!: StreamProcessor;

	constructor (id: string, socket: Net.Socket, selfInfo: NodeInfo, uuid?: string, ref_uuid?: string) {
		super();

		this.id = id;
		this.selfInfo = selfInfo;

		if (uuid) {
			this.uuid = uuid;
			this.keepAlive = true;
		}
		this.ref_uuid = ref_uuid;

		this.socket = socket;

		this.socket.on("end", this.socketDisconnected.bind(this));
		this.socket.on("close", this.socketDisconnected.bind(this));
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
		this.socket.destroySoon();

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
		}
	}

	socketDisconnected () {
		this.send(this.address!.parent, {
			command: "socketDisconnected",
			data: {
				id: this.id
			}
		});
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

	processHeartbeat (data: { uuid: string; title: string; description: string; ref_uuid?: string; }) {
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
		} else {
			this.socket.destroySoon();
		}
	}

	ask (uuid: string) {
		this.sendEvent({
			command: "ask",
			data: { uuid }
		});
	}

	askRequest (data: { uuid: string }) {
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
		this.send(this.address!.parent, {
			command: "askResponse",
			data: data
		});
	}

	sendNodeInfoChanged (data: { title: string; description: string; }) {
		this.sendEvent({
			command: "nodeInfoChanged",
			data: data
		});
	}

	processNodeInfoChanged (data: { title: string; description: string; }) {
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
}