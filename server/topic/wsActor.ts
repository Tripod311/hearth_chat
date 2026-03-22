import { WebSocket } from "ws"
import { Log } from "@tripod311/dispatch"
import Actor from "./actor.js"

export default class WSActor extends Actor {
	private socket: WebSocket;
	private timeout?: ReturnType<typeof setTimeout>;

	constructor (is_admin: boolean, display_name: string, id: number, node_id: string | null, node_user_id: number, socket: WebSocket) {
		super(is_admin, display_name, id, node_id, node_user_id);

		this.socket = socket;

		this.socket.on("message", this.handleMessage.bind(this));
		this.socket.on("close", this.handleClose.bind(this));
		this.socket.on("error", this.handleClose.bind(this));

		this.pingSocket();
	}

	kill () {
		clearTimeout(this.timeout);
	}

	handleMessage (data: Buffer) {
		const raw = data.toString();

		try {
			const message = JSON.parse(raw) as { command: string; data: any; };

			switch (message.command) {
				case "pong":
					clearTimeout(this.timeout);
					this.timeout = setTimeout(this.pingSocket.bind(this), 1000 * 60);
					break;
				case "pushMessage":
					this.emit("pushMessage", message.data);
					break;
				case "fetchMessages":
					this.emit("fetchMessages", message.data);
					break;
			}
		} catch (err: any) {
			Log.warning("WS message error: " + err.toString(), 0);
		}
	}

	handleClose () {
		clearTimeout(this.timeout);
		this.emit("disconnected");
	}

	proxy (data: string) {
		if (this.socket.bufferedAmount > 1000000) {
			this.socket.close()
			return;
		}

		this.socket.send(data);
	}

	pingSocket () {
		this.socket.send(JSON.stringify({ command: "ping" }));

		this.timeout = setTimeout(this.socketTimeout.bind(this), 1000 * 60);
	}

	socketTimeout () {
		this.emit("disconnected");
	}
}