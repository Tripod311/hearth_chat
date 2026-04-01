import Net from "net"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import { StreamingMultipartFile } from "@tripod311/currents"

import NodeConnection from "./nodeConnection.js"
import Proxy from "./proxy.js"

const NODE_CONNECT_AWAIT = 1000 * 60;

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
	private pendingConnections: Record<string, { timeout: ReturnType<typeof setTimeout>; events: Event[] }> = {};

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
		this.setListener("nodeOnline", this.nodeOnline.bind(this));
		this.setListener("socketDisconnected", this.socketDisconnected.bind(this));
		this.setListener("checkNodeRegistered", this.searchNode.bind(this));
		this.setListener("askResponse", this.askResponse.bind(this));
		this.setListener("connectNode", this.connectNode.bind(this));
		this.setListener("fetchTitle", this.fetchTitle.bind(this));
		this.setListener("fetchTopics", this.fetchTopics.bind(this));
		this.setListener("fetchRelated", this.fetchRelated.bind(this));
		this.setListener("wsConnection", this.wsConnection.bind(this));
		this.setListener("closeConnection", this.closeConnection.bind(this));
		this.setListener("pushFiles", this.pushFiles.bind(this));
		this.setListener("getFile", this.getFile.bind(this));
	}

	detach () {
		for (const id in this.pendingConnections) {
			clearTimeout(this.pendingConnections[id].timeout);
		}

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
					const conn = new NodeConnection(id, socket, this.selfInfo, node.uuid, true);

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

	closeConnection (event: Event) {
		const uuid = event.data.data.uuid;

		for (const id in this.subNodes) {
			if ((this.subNodes[id] as NodeConnection).uuid === uuid) {
				this.delChild(id);
				return;
			}
		}
	}

	nodeOnline (event: Event) {
		const uuid = event.data.data.uuid;

		if (this.pendingConnections[uuid]) {
			clearTimeout(this.pendingConnections[uuid].timeout);
			for (const ev of this.pendingConnections[uuid].events) {
				ev.response({
					command: "connectNodeResponse",
					error: false
				});
			}
			delete this.pendingConnections[uuid];
		}

		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.send(dbAddress, {
			command: "nodeOnline",
			data: { uuid }
		});
	}

	nodeInfoChanged (event: Event) {
		for (const node of Object.values(this.subNodes)) {
			(node as NodeConnection).sendNodeInfoChanged(event.data.data);
		}
	}

	connectNode (event: Event) {
		const uuid: string = event.data.data.uuid;
		const ref_uuid: string = event.data.data.ref_uuid;

		// check if there is established connection

		let dstNode: NodeConnection | undefined = undefined;

		for (const nodeId in this.subNodes) {
			const node = this.subNodes[nodeId] as NodeConnection;
			if (node.uuid === uuid){
				dstNode = node;
				break;
			}
		}

		if (dstNode !== undefined) {
			dstNode.refresh();
			event.response({
				command: "connectNodeResponse",
				error: false
			});
			return;
		}

		// check if there's awaited node
		if (this.pendingConnections[uuid] !== undefined) {
			this.pendingConnections[uuid].events.push(event);
			return;
		}

		this.pendingConnections[uuid] = {
			timeout: setTimeout(this.nodeConnectionFailed.bind(this, uuid), NODE_CONNECT_AWAIT),		
			events: [event]
		};

		// search for node
		this.chain(this.address!, {
			command: "checkNodeRegistered",
			data: { uuid, ref_uuid }
		}, (response: Event) => {
			if (response.data.error) {
				this.nodeConnectionFailed(uuid);
			} else {
				const socket = Net.createConnection({ host: response.data.data.ip, port: response.data.data.port });

				const id = (this.counter++).toString();
				const conn = new NodeConnection(id, socket, this.selfInfo, uuid, false);

				this.addChild(id, conn);
			}
		});
	}

	nodeConnectionFailed (uuid: string) {
		if (this.pendingConnections[uuid]) {
			clearTimeout(this.pendingConnections[uuid].timeout);
			for (const ev of this.pendingConnections[uuid].events) {
				ev.response({
					command: "connectNodeResponse",
					error: true
				})
			}
			delete this.pendingConnections[uuid];
		}
	}

	fetchTitle (event: Event) {
		const uuid = event.data.data.uuid;

		let node: NodeConnection | undefined = undefined;

		for (const id in this.subNodes) {
			const n = this.subNodes[id] as NodeConnection;

			if (n.uuid === uuid) {
				node = n;
				break;
			}
		}

		if (!node) {
			event.response({
				command: "fetchTitleResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.sendFetchTitle(event);
		}
	}

	fetchTopics (event: Event) {
		const uuid = event.data.data.uuid;

		let node: NodeConnection | undefined = undefined;

		for (const id in this.subNodes) {
			const n = this.subNodes[id] as NodeConnection;

			if (n.uuid === uuid) {
				node = n;
				break;
			}
		}

		if (!node) {
			event.response({
				command: "fetchTopicsResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.sendFetchTopics(event);
		}
	}

	fetchRelated (event: Event) {
		const uuid = event.data.data.uuid;

		let node: NodeConnection | undefined = undefined;

		for (const id in this.subNodes) {
			const n = this.subNodes[id] as NodeConnection;

			if (n.uuid === uuid) {
				node = n;
				break;
			}
		}

		if (!node) {
			event.response({
				command: "fetchRelatedResponse",
				error: true,
				details: "Node not found"
			})
		} else {
			node.sendFetchRelated(event);
		}
	}

	wsConnection (event: Event) {
		const socket = event.data.data.socket;
		const uuid = event.data.data.topic_node;
		const node_user_id = event.data.data.node_user_id;
		const topic_id = event.data.data.topic_id;
		const display_name = event.data.data.display_name;

		let node: NodeConnection | undefined = undefined;

		for (const id in this.subNodes) {
			const n = this.subNodes[id] as NodeConnection;

			if (n.uuid === uuid) {
				node = n;
				break;
			}
		}

		if (!node) {
			socket.destroy();
		} else {
			node.createLocalProxy(socket, topic_id, node_user_id, display_name);
		}
	}

	async pushFiles (event: Event) {
		const uuid = event.data.data.uuid;

		let node: NodeConnection | undefined = undefined;

		for (const id in this.subNodes) {
			const n = this.subNodes[id] as NodeConnection;

			if (n.uuid === uuid) {
				node = n;
				break;
			}
		}

		if (node === undefined) {
			for (const file of event.data.data.files) {
				await (file as StreamingMultipartFile).clear();
			}

			event.response({
				command: "pushFilesResponse",
				error: true,
				details: "Node not found"
			});
		} else {
			const handlesAddr = this.address!.data;
			handlesAddr.push(node.id, "fileHandles");

			this.chain(handlesAddr, {
				command: "pushFiles",
				data: event.data.data
			}, (response: Event) => {
				if (response.data.error) {
					event.response({
						command: "pushFilesResponse",
						error: true,
						details: response.data.details
					});
				} else {
					event.response({
						command: "pushFilesResponse",
						error: false,
						data: response.data.data
					});
				}
			});
		}
	}

	getFile (event: Event) {
		const uuid = event.data.data.uuid;

		let node: NodeConnection | undefined = undefined;

		for (const id in this.subNodes) {
			const n = this.subNodes[id] as NodeConnection;

			if (n.uuid === uuid) {
				node = n;
				break;
			}
		}

		if (node === undefined) {
			event.response({
				command: "getFileResponse",
				error: true,
				details: "Node not found"
			});
		} else {
			const handlesAddr = this.address!.data;
			handlesAddr.push(node.id, "fileHandles");

			this.chain(handlesAddr, {
				command: "getFile",
				data: event.data.data
			}, (response: Event) => {
				if (response.data.error) {
					event.response({
						command: "getFileResponse",
						error: true,
						details: response.data.details
					});
				} else {
					event.response({
						command: "getFileResponse",
						error: false,
						data: response.data.data
					});
				}
			});
		}
	}
}