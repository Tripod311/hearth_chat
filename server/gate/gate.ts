import Net from "net"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"

import NodeConnection from "./nodeConnection.js"

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const NODE_CONNECT_AWAIT = 1000 * 60;

export interface NodeInfo {
	uuid: string;
	ip: string;
	port: number;
	title: string;
	description: string;
	direct?: number;
}

export default class Gate extends Node {
	private selfInfo: NodeInfo;
	private server: Net.Server;
	private counter: number = 0;

	private unassignedPromise?: Promise<string>;
	private unassignedIds: Map<number, ReturnType<typeof setTimeout>> = new Map();
	private unassignedResolve?: (uuid: string) => void;

	private pendingAsks: Record<string, Record<string, Event[]>> = {};
	private pendingConnections: Record<string, any> = {};

	constructor (selfInfo: NodeInfo) {
		super();

		this.selfInfo = selfInfo;
		this.server = Net.createServer(this.incomingConnection.bind(this));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.listen(this.selfInfo.port, () => {
			Log.success(`Gate opened on ${this.selfInfo.port}`, 0);
		});

		this.makeInitialConnections();

		this.setListener("nodeOnline", this.nodeOnline.bind(this));
		this.setListener("socketDisconnected", this.socketDisconnected.bind(this));
		this.setListener("wsConnection", this.wsConnection.bind(this));
		this.setListener("closeConnection", this.closeConnection.bind(this));

		this.setListener("checkNodeRegistered", this.checkNodeRegistered.bind(this));
		this.setListener("askResponse", this.askResponse.bind(this));

		this.setListener("nodeInfoChanged", this.nodeInfoChanged.bind(this));
		this.setListener("connectNode", this.connectNode.bind(this));
		this.setListener("fetchTitle", this.fetchTitle.bind(this));
		this.setListener("fetchTopics", this.fetchTopics.bind(this));
		this.setListener("fetchRelated", this.fetchRelated.bind(this));
		this.setListener("pushFiles", this.pushFiles.bind(this));
		this.setListener("getFile", this.getFile.bind(this));
		this.setListener("getActorInfo", this.getActorInfo.bind(this));
	}

	detach () {
		for (const t of this.unassignedIds.values()) {
			clearTimeout(t);
		}

		this.server.close();

		super.detach();
	}

	incomingConnection (socket: Net.Socket) {
		const id = this.counter++;
		const conn = new NodeConnection(id.toString(), socket, this.selfInfo);

		this.addChild(id.toString(), conn);

		this.addUnassigned(id);
	}

	async makeInitialConnections () {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "fetchDirectNodes",
			data: {}
		}, async (response: Event) => {
			if (response.data.error) {
				Log.error(response.data.details!, 0);
				process.exit(1);
			} else {
				const nodes = response.data.data as { uuid: string; ip: string; port: number; title: string; description: string; }[];

				for (const node of nodes) {
					try {
						await this.createConnection(node.uuid, node.ip, node.port, true);
					} catch (err: any) {
						// do nothing
					}
				}
			}
		});
	}

	nodeOnline (event: Event) {
		const id = event.data.data.id;
		const intId = parseInt(id);
		const uuid = event.data.data.uuid;

		if (this.unassignedIds.has(intId)) {
			this.resolveUnassigned(intId, uuid);
		}

		if (this.pendingConnections[uuid] !== undefined) {
			this.resolvePending(uuid);
		}

		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.send(dbAddress, {
			command: "nodeOnline",
			data: { uuid }
		});
	}

	socketDisconnected (event: Event) {
		const id = event.data.data.id;
		const intId = parseInt(id);
		const child = this.getChild(id);

		if (child) {
			const uuid = (child as NodeConnection).uuid;

			if (this.unassignedIds.has(intId)) {
				this.resolveUnassigned(intId, ZERO_UUID);
			}

			if (uuid) {
				if (this.pendingConnections[uuid] !== undefined) {
					this.rejectPending(uuid);
				}

				if (this.pendingAsks[uuid]) {
					for (const aId in this.pendingAsks[uuid]) {
						const arr = this.pendingAsks[uuid][aId];

						for (const ev of arr) {
							ev.response({
								command: "checkNodeRegisteredResponse",
								error: true,
								details: "nodeDisconnected"
							})
						}
					}

					delete this.pendingAsks[uuid];
				}

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

	closeConnection (event: Event) {
		const uuid = event.data.data.uuid;

		for (const id in this.subNodes) {
			if ((this.subNodes[id] as NodeConnection).uuid === uuid) {
				this.delChild(id);
				return;
			}
		}
	}

	closeConnectionById (closeId: string) {
		for (const id in this.subNodes) {
			if (id === closeId) {
				this.delChild(id);
				return;
			}
		}
	}

	nodeInfoChanged (event: Event) {
		this.selfInfo.title = event.data.data.title;
		this.selfInfo.description = event.data.data.description;

		for (const node of Object.values(this.subNodes)) {
			(node as NodeConnection).callMethod("sendInfoChanged", event.data.data);
		}
	}

	getActorInfo (event: Event) {
		const uuid = event.data.data.uuid;
		const id = event.data.data.id;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			event.response({
				command: "getActorInfoResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.callMethod("getActorInfo", event);
		}
	}

	fetchTitle (event: Event) {
		const uuid = event.data.data.uuid;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			event.response({
				command: "fetchTitleResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.callMethod("fetchTitle", event);
		}
	}

	fetchTopics (event: Event) {
		const uuid = event.data.data.uuid;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			event.response({
				command: "fetchTopicsResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.callMethod("fetchTopics", event);
		}
	}

	fetchRelated (event: Event) {
		const uuid = event.data.data.uuid;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			event.response({
				command: "fetchRelatedResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.callMethod("fetchRelated", event);
		}
	}

	wsConnection (event: Event) {
		const socket = event.data.data.socket;
		const uuid = event.data.data.topic_node;
		const node_user_id = event.data.data.node_user_id;
		const topic_id = event.data.data.topic_id;
		const display_name = event.data.data.display_name;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			socket.destroy();
		} else {
			node.callMethod("createLocalProxy", { socket, topic_id, node_user_id, display_name });
		}
	}

	pushFiles (event: Event) {
		const uuid = event.data.data.uuid;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			event.response({
				command: "pushFilesResponse",
				error: true,
				details: "Node not found"
			});
		} else {
			node.callMethod("pushFiles", event);
		}
	}

	getFile (event: Event) {
		const uuid = event.data.data.uuid;

		const node = this.getNodeByUUID(uuid);

		if (node === null) {
			event.response({
				command: "getFileResponse",
				error: true,
				details: "Node not found"
			});
		} else {
			node.callMethod("getFile", event);
		}
	}

	async checkNodeRegistered (event: Event) {
		const uuid = event.data.data.uuid;
		const ref_uuid = event.data.data.ref_uuid;

		try {
			const info = await this.checkCached(uuid);

			event.response({
				command: "checkNodeRegisteredResponse",
				data: info
			});
			return;
		} catch (err: any) {
			if (ref_uuid === undefined) {
				event.response({
					command: "checkNodeRegisteredResponse",
					error: true,
					details: "Node not found"
				});	
				return;
			}
		}

		const refNode = this.getNodeByUUID(ref_uuid);

		if (refNode !== null) {
			if (!this.pendingAsks[ref_uuid]) this.pendingAsks[ref_uuid] = {};
			if (!this.pendingAsks[ref_uuid][uuid]) this.pendingAsks[ref_uuid][uuid] = [];

			this.pendingAsks[ref_uuid][uuid].push(event);

			refNode.callMethod("ask", uuid);
			return;
		}

		try {
			const refInfo = await this.checkCached(ref_uuid);

			const node = await this.createConnection(ref_uuid, refInfo.ip, refInfo.port, refInfo.direct === 1);

			if (!this.pendingAsks[ref_uuid]) this.pendingAsks[ref_uuid] = {};
			if (!this.pendingAsks[ref_uuid][uuid]) this.pendingAsks[ref_uuid][uuid] = [];

			this.pendingAsks[ref_uuid][uuid].push(event);

			node.callMethod("ask", uuid);
		} catch (err: any) {
			event.response({
				command: "checkNodeRegisteredResponse",
				error: true,
				details: "Node not found"
			});
		}
	}

	askResponse (event: Event) {
		const ref_uuid = event.data.data.ref_uuid;
		const result = event.data.data.response;
		const uuid = result.uuid;

		if (this.pendingAsks[ref_uuid] && this.pendingAsks[ref_uuid][uuid]) {
			const arr = this.pendingAsks[ref_uuid][uuid] as Event[];

			if (result.ok) {
				const dbAddress = this.address!.parent.data;
				dbAddress.push("db");

				this.send(dbAddress, {
					command: "rememberNode",
					data: {
						uuid: uuid,
						ip: result.ip,
						port: result.port
					}
				});

				for (const ev of arr) {
					ev.response({
						command: "checkNodeRegisteredResponse",
						error: false,
						data: result
					})
				}
			} else {
				for (const ev of arr) {
					ev.response({
						command: "checkNodeRegisteredResponse",
						error: true,
						details: "Node not found"
					})
				}
			}

			delete this.pendingAsks[ref_uuid][uuid];
		}
	}

	addUnassigned (id: number) {
		this.unassignedIds.set(id, setTimeout(() => {
			this.closeConnectionById(id.toString());
		}, NODE_CONNECT_AWAIT));

		this.unassignedPromise = new Promise((resolve, reject) => {
			this.unassignedResolve = resolve;
		})
	}

	resolveUnassigned (id: number, uuid: string) {
		if (this.unassignedIds.has(id)) {
			clearTimeout(this.unassignedIds.get(id));
			this.unassignedIds.delete(id);

			this.unassignedResolve && this.unassignedResolve(uuid);

			if (this.unassignedIds.size > 0) {
				this.unassignedPromise = new Promise((resolve, reject) => {
					this.unassignedResolve = resolve;
				});
			} else {
				delete this.unassignedPromise;
				delete this.unassignedResolve;
			}
		}
	}

	resolvePending (uuid: string) {
		const cb = this.pendingConnections[uuid]!.resolve as ((n: NodeConnection) => void);
		delete this.pendingConnections[uuid];

		for (const id in this.subNodes) {
			const node = this.subNodes[id] as NodeConnection;

			if (node.uuid === uuid) {
				cb(node);
				return;
			}
		}
	}

	rejectPending (uuid: string) {
		const cb = this.pendingConnections[uuid]!.reject as (() => void);
		delete this.pendingConnections[uuid];
		cb();
	}

	getNodeByUUID (uuid: string): NodeConnection | null {
		for (const id in this.subNodes) {
			if ((this.subNodes[id] as NodeConnection).uuid === uuid) {
				return (this.subNodes[id] as NodeConnection);
			}
		}

		return null;
	}

	checkCached (uuid: string): Promise<NodeInfo> {
		return new Promise((resolve, reject) => {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "checkNodeRegistered",
				data: { uuid }
			}, (response: Event) => {
				if (response.data.error) {
					reject("Node not found");
				} else {
					resolve(response.data.data as NodeInfo);
				}
			});
		});
	}

	createConnection (uuid: string, ip: string, port: number, keepAlive: boolean, ref_uuid?: string): Promise<NodeConnection> {
		if (this.pendingConnections[uuid]) return this.pendingConnections[uuid].promise;

		this.pendingConnections[uuid] = {};

		const pr = new Promise<NodeConnection>((resolve, reject) => {
			const created = this.getNodeByUUID(uuid);

			if (created !== null) {
				resolve(created);
				return;
			}

			const id = this.counter++;
			const socket = Net.createConnection({ host: ip, port: port });
			const conn = new NodeConnection(id.toString(), socket, this.selfInfo, uuid, ref_uuid, keepAlive);

			this.addChild(id.toString(), conn);

			this.pendingConnections[uuid].resolve = resolve;
			this.pendingConnections[uuid].reject = reject;
		});

		this.pendingConnections[uuid].promise = pr;

		return pr;
	}

	async connectNode (event: Event) {
		const uuid = event.data.data.uuid;
		const ref_uuid = event.data.data.ref_uuid;

		// maybe we already have connection

		const node = this.getNodeByUUID(uuid);

		if (node !== null) {
			event.response({
				command: "connectNodeResponse",
				error: false
			});
			return;
		}

		// maybe we are waiting for this node to connect
		if (this.pendingConnections[uuid] !== undefined) {
			try {
				await this.pendingConnections[uuid].promise;

				event.response({
					command: "connectNodeResponse",
					error: false
				});
				return;
			} catch (err: any) {
				event.response({
					command: "connectNodeResponse",
					error: true,
					details: "The node is either offline or the handshake has not been completed"
				});
				return;
			}
		}

		// while there are unassigned nodes wait for them to complete heartbeat
		while (this.unassignedPromise) {
			const created = await this.unassignedPromise;

			if (created === uuid) {
				event.response({
					command: "connectNodeResponse",
					error: false
				});
				return;
			}
		}

		// maybe node is cached?
		try {
			const info = await this.checkCached(uuid);

			await this.createConnection(uuid, info.ip, info.port, info.direct === 1);

			event.response({
				command: "connectNodeResponse",
				error: false
			});
			return;
		} catch (err: any) {

		}

		if (ref_uuid === "self") {
			event.response({
				command: "connectNodeResponse",
				error: true,
				details: "The node is either offline or the handshake has not been completed"
			});
			return;
		}

		const originalResponse = event.response;
		event.response = async (obj: EventData) => {
			if (obj.error) {
				originalResponse.call(event, {
					command: "connectNodeResponse",
					error: true,
					details: "The node is either offline or the handshake has not been completed"
				});
			} else {
				try {
					await this.createConnection(uuid, obj.data.ip, obj.data.port, false, ref_uuid);

					originalResponse.call(event, {
						command: "connectNodeResponse",
						error: false
					});
				} catch (err: any) {
					originalResponse.call(event, {
						command: "connectNodeResponse",
						error: true,
						details: "The node is either offline or the handshake has not been completed"
					});
				}
			}
		}

		this.checkNodeRegistered(event);
	}
}