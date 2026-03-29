import Net from "net"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

import NodeConnection from "./nodeConnection.js"

export interface NodeInfo {
	uuid: string;
	ip: string;
	port: number;
	title: string;
	description: string;
}

export default class Gate extends Node {
	private selfInfo: NodeInfo;
	private server: Net.Server;
	private counter: number = 0;
	private pendingChecks: Record<string, Event[]> = {};

	constructor (selfInfo: NodeInfo) {
		super();

		this.selfInfo = selfInfo;
		this.server = Net.createServer(this.incomingConnection.bind(this));
	}

	incomingConnection (socket: Net.Socket) {
		const id = (this.counter++).toString();
		const conn = new NodeConnection(id, socket, this.selfInfo);

		this.addChild(id, conn);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.listen(this.selfInfo.port, () => {
			Log.success(`Gate opened on ${this.selfInfo.port}`, 0);
		});

		this.makeInitialConnections();

		this.setListener("nodeInfoChanged", this.nodeInfoChanged.bind(this));
		this.setListener("socketDisconnected", this.socketDisconnected.bind(this));
		this.setListener("checkNodeRegistered", this.searchNode.bind(this));
		this.setListener("askResponse", this.askResponse.bind(this));
	}

	detach () {
		this.server.close();

		super.detach();
	}

	makeInitialConnections () {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "fetchDirectNodes",
			data: {}
		}, (response: Event) => {
			if (response.data.error) {
				Log.error(response.data.details!, 0);
				process.exit(1);
			} else {
				const nodes = response.data.data as { uuid: string; ip: string; port: number; title: string; description: string; }[];

				for (const node of nodes) {
					const socket = Net.createConnection({ host: node.ip, port: node.port });

					const id = (this.counter++).toString();
					const conn = new NodeConnection(id, socket, this.selfInfo, node.uuid);

					this.addChild(id, conn);
				}
			}
		});
	}

	searchNode (event: Event) {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "checkNodeRegistered",
			data: event.data.data
		}, (response: Event) => {
			if (response.data.error) {
				// ask referenced neighbor
				let ref: NodeConnection | undefined = undefined;

				for (const node of Object.values(this.subNodes.values)) {
					if ((node as NodeConnection).uuid === event.data.data.ref_uuid) {
						ref = node as NodeConnection;
						break;
					}
				}

				if (ref === undefined) {
					event.response({
						command: "checkNodeRegisteredResponse",
						error: true
					});
				} else {
					if (!this.pendingChecks[event.data.data.uuid]) {
						this.pendingChecks[event.data.data.uuid] = []
					}

					this.pendingChecks[event.data.data.uuid].push(event);

					ref.ask(event.data.data.uuid);
				}
			} else {
				event.response({
					command: "checkNodeRegisteredResponse",
					data: response.data.data
				})
			}
		});
	}

	askResponse (event: Event) {
		const uuid = event.data.data.uuid;

		if (this.pendingChecks[uuid]) {
			if (event.data.data.ok) {
				const dbAddress = this.address!.parent.data;
				dbAddress.push("db");

				this.send(dbAddress, {
					command: "rememberNode",
					data: { uuid: uuid, ip: event.data.data.ip, port: event.data.data.port }
				});

				for (const ev of this.pendingChecks[uuid]) {
					ev.response({
						command: "checkNodeRegisteredResponse",
						data: { ip: event.data.data.ip, port: event.data.data.port }
					});
				}
			} else {
				for (const ev of this.pendingChecks[uuid]) {
					ev.response({
						command: "checkNodeRegisteredResponse",
						error: true
					});
				}
			}
		}
	}

	socketDisconnected (event: Event) {
		const id = event.data.data.id;
		const child = this.getChild(id);

		if (child) {
			if ((child as NodeConnection).uuid) {
				const dbAddress = this.address!.parent.data;
				dbAddress.push("db");

				this.send(dbAddress, {
					command: "nodeOffline",
					data: { uuid: (child as NodeConnection).uuid }
				});
			}

			this.delChild(id);
		}
	}

	nodeOnline (event: Event) {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.send(dbAddress, {
			command: "nodeOnline",
			data: { uuid: event.data.data.uuid }
		});
	}

	nodeInfoChanged (event: Event) {
		for (const node of Object.values(this.subNodes)) {
			(node as NodeConnection).sendNodeInfoChanged(event.data.data);
		}
	}
}