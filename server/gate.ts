import Net from "net"
import { Node, Dispatcher, Address, Event, Log, StreamProcessor } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"

interface Actor {
	node_id: string;
	node_user_id: number;
}

class Connection extends Node {
	private id!: string;
	private keepAlive: boolean = false;
	private socket: Net.Socket;
	private processor!: StreamProcessor;
	private dbAddress!: Address;
	private accessAddress!: Address;

	constructor (socket: Net.Socket, id?: string) {
		super();

		if (id) {
			this.id = id;
			this.keepAlive = true;
		}

		this.socket = socket;

		this.socket.on("end", this.socketDisconnected.bind(this));
		this.socket.on("close", this.socketDisconnected.bind(this));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.processor = new StreamProcessor(dispatcher, this.socket);
		this.processor.on("message", this.processMessage.bind(this));

		this.dbAddress = new Address([this.address!.data[0], "db"]);
		this.accessAddress = new Address([this.address!.data[0], "access"]);
	}

	detach () {
		this.socket.destroySoon();

		super.detach();
	}

	processMessage (event: Event) {
		switch (event.data.command) {
			case "heartbeat":
				this.heartbeat(event.data.data);
				break;
			case "seek":
				this.seek(event.data.data);
				break;
			case "getTitle":
				this.getTitle(event.data.data);				
				break;
			case "getTopics":
				this.getTopics(event.data.data);				
				break;
			case "getRelated":
				this.getRelated(event.data.data);
				break;
			case "actorConnected":
				this.actorConnected(event.data.data);
				break;
			case "actorDisconnected":
				this.actorDisconnected(event.data.data);
				break;
			case "actorUpdated":
				this.actorUpdated(event.data.data);
				break;
			case "pushTopicMessage":
				this.pushTopicMessage(event.data.data);
				break;
			case "fetchTopicMessages":
				this.fetchTopicMessages(event.data.data);
				break;
		}
	}

	get uuid (): string {
		return this.id;
	}

	socketDisconnected () {
		this.send(this.address!.parent, {
			command: "socketDisconnected",
			data: {
				uuid: this.id
			}
		});
	}

	heartbeat (data: EventData) {
		const uuid = data.data.uuid as string;

		this.id = uuid;

		this.send(this.address!.parent, {
			command: "heartbeat",
			data: data
		});

		this.chain(this.dbAddress, {
			command: "checkDirectNode",
			data: {
				uuid: this.id
			}
		}, (response: Event) => {
			if (response.data.error) {
				Log.warning(`Node ${ this.id } is not cached, yet connected`, 0);
			} else {
				this.keepAlive = response.data.data.direct;
			}
		})
	}

	seek (data: EventData) {
		
	}

	getTitle (data: EventData) {
		
	}

	getTopics (data: EventData) {
		
	}

	getRelated (data: EventData) {
		
	}

	actorConnected (data: EventData) {
		
	}

	actorDisconnected (data: EventData) {
		
	}

	actorUpdated (data: EventData) {
		
	}

	pushTopicMessage (data: EventData) {
		
	}

	fetchTopicMessages (data: EventData) {
		
	}
}

export default class Gate extends Node {
	private selfId: string;
	private port: number;
	private server: Net.Server;
	private connections: Record<number, Connection> = {};
	private counter: number = 0;

	constructor (selfId: string, port: number) {
		super();

		this.selfId = selfId;
		this.port = port;
		this.server = Net.createServer(this.incomingConnection.bind(this));
	}

	incomingConnection (socket: Net.Socket) {
		const id = this.counter++;
		const conn = new Connection(socket);

		this.connections[id] = conn;

		this.addChild(id.toString(), conn);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.listen(this.port, () => {
			Log.success(`Gate opened on ${this.port}`, 0);
		});

		this.makeInitialConnections();

		this.setListener("heartbeat", this.heartbeat.bind(this));
		this.setListener("seek", this.seek.bind(this));
		this.setListener("socketDisconnected", this.socketDisconnected.bind(this));
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
				const nodes = response.data.data as { uuid: string; url: string }[];

				for (const node of nodes) {
					try {
						const [host, port] = node.url.split(':');

						const socket = Net.createConnection({ host: host, port: parseInt(port) });

						const id = this.counter++;
						const conn = new Connection(socket);

						this.addChild(id.toString(), conn);

						Log.success(`Connected to ${ node.uuid }`, 0);
					} catch (err: any) {
						Log.info(`Couldn't connect to ${ node.uuid }, marking offline`, 0);
					}
				}

				// heartbeat with self id
			}
		});
	}

	private findNode (uuid: string): Connection | null {
		for (const id in this.connections) {
			const connection = this.connections[id];

			if (connection.uuid === uuid) return connection;
		}

		return null;
	}

	heartbeat (event: Event) {

	}

	seek (event: Event) {

	}

	socketDisconnected (event: Event) {

	}
}