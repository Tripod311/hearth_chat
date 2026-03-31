import { WebSocket } from "ws"
import Proxy from "./proxy.js"

export default class LocalProxy extends Proxy {
	private socket: WebSocket;
	private inBuffer: string[] = [];
	private outBuffer: string[] = [];

	constructor (socket: WebSocket, id: number, topic_id: number, node_user_id: number, display_name: string) {
		super(id, topic_id, node_user_id, display_name);

		this.socket = socket;

		this.socket.on("close", this.onDestroyed.bind(this));
		this.socket.on("message", this.forward.bind(this));
	}

	ready () {
		this.is_ready = true;

		for (const str of this.outBuffer) {
			this.emit("forward", str);
		}

		for (const str of this.inBuffer) {
			this.emit("event", str);
		}

		this.outBuffer.length = 0;
		this.inBuffer.length = 0;
	}

	kill () {
		this.socket.terminate();
	}

	forward (data: Buffer) {
		if (!this.is_ready) {
			this.outBuffer.push(data.toString());
		} else {
			this.emit("forward", data.toString());
		}
	}

	receive (data: string) {
		if (!this.is_ready) {
			this.inBuffer.push(data);
		} else {
			this.emit("event", data);
		}
	}
}