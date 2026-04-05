import { WebSocket } from "ws"
import Proxy from "./proxy.js"

export default class RemoteProxy extends Proxy {
	private inBuffer: string[] = [];
	private outBuffer: string[] = [];

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
		this.onDestroyed();
	}

	forward (data: string) {
		if (!this.is_ready) {
			this.outBuffer.push(data);
		} else {
			this.emit("forward", data);
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