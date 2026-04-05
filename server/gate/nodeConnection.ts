import Net from "net"
import { Node, Dispatcher, Address, Event, Log, StreamProcessor, SerializeEvent } from "@tripod311/dispatch"
import type { EventData } from "@tripod311/dispatch"
import type { NodeInfo } from "./gate.js"

import setupHeartbeat from "./protocol/heartbeat.js"
import setupPing from "./protocol/ping.js"
import setupNodeInfo from "./protocol/nodeInfo.js"
import setupAsk from "./protocol/ask.js"
import setupFetchTitle from "./protocol/fetchTitle.js"
import setupFetchTopics from "./protocol/fetchTopics.js"
import setupFetchRelated from "./protocol/fetchRelated.js"
import setupProxy from "./protocol/proxy.js"
import setupPushFiles from "./protocol/pushFiles.js"
import setupGetFile from "./protocol/getFile.js"

const NODE_KEEPALIVE = 1000 * 60 * 10;

export default class NodeConnection extends Node {
	public id: string;
	public selfInfo: NodeInfo;
	public uuid?: string;
	public ref_uuid?: string;
	public is_outcoming_connection: boolean = false;
	public keepAlive: boolean = false;

	private socket: Net.Socket;
	private processor!: StreamProcessor;

	private variables: Map<string, any> = new Map();
	private methods: Map<string, Function> = new Map();
	private routes: Map<string, Function> = new Map();
	private finishers: Set<Function> = new Set();

	private timeout?: ReturnType<typeof setTimeout>;

	constructor (id: string, socket: Net.Socket, selfInfo: NodeInfo, uuid?: string, ref_uuid?: string, keepAlive: boolean = false) {
		super();

		this.id = id;
		this.selfInfo = selfInfo;

		this.uuid = uuid;
		this.ref_uuid = ref_uuid;
		this.keepAlive = keepAlive;

		this.is_outcoming_connection = !!this.uuid;

		this.socket = socket;
		this.socket.setKeepAlive(true, 15000);

		this.socket.on("end", this.socketDisconnected.bind(this));
		this.socket.on("close", this.socketDisconnected.bind(this));
		this.socket.on("error", this.socketDisconnected.bind(this));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.processor = new StreamProcessor(dispatcher, this.socket);
		this.processor.on("message", this.routeMessage.bind(this));
		this.processor.on("error", this.socketDisconnected.bind(this));

		this.registerMethod("sendEvent", this.sendEvent.bind(this));
		this.registerMethod("forceClose",this.socketDisconnected.bind(this));
		this.registerMethod("refresh", this.refresh.bind(this));
		this.registerMethod("suspend", this.refresh.bind(this));

		setupHeartbeat(this);
		setupPing(this);
		setupNodeInfo(this);
		setupAsk(this);
		setupFetchTitle(this);
		setupFetchTopics(this);
		setupFetchRelated(this);
		setupProxy(this);
		setupPushFiles(this);
		setupGetFile(this);

		if (this.is_outcoming_connection) {
			this.refresh();
			this.callMethod("sendHeartbeat");
		}
	}

	detach () {
		clearTimeout(this.timeout);
		Log.info(`Node ${this.uuid} disconnected`, 0);

		for (const finisher of this.finishers) {
			finisher.call(this);
		}

		this.socket.destroy();

		super.detach();
	}

	setVariable (name: string, obj: any) {
		this.variables.set(name, obj);
	}

	getVariable (name: string): any {
		return this.variables.get(name);
	}

	registerMethod (name: string, fn: Function) {
		this.methods.set(name, fn)
	}

	callMethod (name: string, data?: any) {
		try {
			const fn = this.methods.get(name);

			if (fn) fn.call(this, data);
			else Log.warning(`NodeConnection error: method ${name} is not registered`, 0);
		} catch (err: any) {
			Log.warning(`Method ${name} error: ${err.toString}`, 0);
		}
	}

	registerRoute (name: string, fn: Function) {
		this.routes.set(name, fn)
	}

	callRoute (name: string, data: any) {
		try {
			const fn = this.routes.get(name);

			if (fn) fn.call(this, data);
			else Log.warning(`NodeConnection error: route ${name} is not registered`, 0);
		} catch (err: any) {
			Log.warning(`Route ${name} error: ${err.toString}`, 0);
		}
	}

	registerFinisher (fn: Function) {
		this.finishers.add(fn);
	}

	routeMessage (event: Event) {
		Log.success("IN: " + JSON.stringify(event.data), 0);

		this.callRoute(event.data.command, event.data);
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
		Log.info("OUT: " + JSON.stringify(data), 0);
		const ev = new Event(
			this.dispatcher!,
			new Address([]),
			new Address([]),
			data
		);
		const buf = SerializeEvent(ev);

		if (!this.socket.destroyed) {
			this.socket.write(buf, (err: any) => {
				if (err) {
					Log.warning(`Socket disconnected on write: ${err.toString()}`, 0);

					this.socketDisconnected();
				}
			});
		}
	}

	timeoutShutdown () {
		this.socket.destroy();
	}

	refresh () {
		clearTimeout(this.timeout);
		
		const proxies = this.getVariable("proxies");

		if (!this.keepAlive && proxies.size === 0) {
			this.timeout = setTimeout(this.timeoutShutdown.bind(this), NODE_KEEPALIVE);
		}
	}

	suspend () {
		clearTimeout(this.timeout);
	}

	get normalizedIP (): string {
		const ip = this.socket.remoteAddress as string;

		return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
	}
}