import mediasoup from "mediasoup"
import { WebSocket } from "ws"
import { Log } from "@tripod311/dispatch"
import Actor from "./actor.js"

export default class WSActor extends Actor {
	private socket: WebSocket;
	private timeout?: ReturnType<typeof setTimeout>;

	constructor (is_admin: boolean, is_bot: boolean, display_name: string, id: number, node_id: string | null, node_user_id: number, socket: WebSocket) {
		super(is_admin, is_bot, display_name, id, node_id, node_user_id);

		this.socket = socket;

		this.socket.on("message", this.handleMessage.bind(this));
		this.socket.on("close", this.handleClose.bind(this));
		this.socket.on("error", this.handleClose.bind(this));

		this.pingSocket();
	}

	kill () {
		clearTimeout(this.timeout);

		this.socket.terminate();

		super.kill();
	}

	async handleMessage (data: Buffer) {
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
				case "createTransport":
					await this.createTransports();
					break;
				case "connectTransport":
					await this.connectTransport(message.data.id, message.data.dtlsParameters);
					break;
				case "deleteTransport":
					await this.deleteTransports();
					break;
				case "createProducer":
					await this.createProducer(message.data.kind, message.data.rtpParameters);
					break;
				case "deleteProducer":
					await this.deleteProducer(message.data.kind);
					break;
				case "createConsumer":
					await this.createConsumer(message.data.producerId, message.data.rtpCapabilities);
					break;
				case "resumeConsumer":
					await this.resumeConsumer(message.data.id);
					break;
				case "deleteConsumer":
					await this.deleteConsumer(message.data.id);
					break;
			}
		} catch (err: any) {
			Log.warning("WS message error: " + err.toString(), 0);
		}
	}

	handleClose () {
		clearTimeout(this.timeout);
		this.deleteTransports();
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

	async createTransports () {
		if (this.authorized) {
			await super.createSendTransport();
			await super.createRecvTransport();

			this.socket.send(JSON.stringify({
				command: "transportCreated",
				data: {
					send: {
						id: this.sendTransport,
						...this.media.webrtcTransportInfo(this.sendTransport!)
					},
					recv: {
						id: this.recvTransport,
						...this.media.webrtcTransportInfo(this.recvTransport!)
					}
				}
			}));

			this.emit("mediaChange");
		}
	}

	async deleteTransports () {
		await super.deleteSendTransport();
		await super.deleteRecvTransport();

		this.socket.send(JSON.stringify({
			command: "transportDeleted"
		}));
	}

	async connectTransport (id: string, dtlsParameters: any) {
		await this.media.connectTransport(id, dtlsParameters);

		this.socket.send(JSON.stringify({
			command: "transportConnected",
			data: { id }
		}));
	}

	async createProducer (kind: string, rtpParameters: any): Promise<string> {
		const id =await super.createProducer(kind, rtpParameters);

		this.socket.send(JSON.stringify({
			command: "producerCreated",
			data: { kind, id }
		}))

		return id
	}

	async deleteProducer (kind: string) {
		await super.deleteProducer(kind);

		this.socket.send(JSON.stringify({
			command: "producerDeleted",
			data: { kind }
		}));
	}

	async pauseProducer (kind: string) {
		await super.pauseProducer(kind);

		this.socket.send(JSON.stringify({
			command: "producerPaused",
			data: { kind }
		}));
	}

	async resumeProducer (kind: string) {
		await super.resumeProducer(kind);

		this.socket.send(JSON.stringify({
			command: "producerResumed",
			data: { kind }
		}));
	}

	async createConsumer (producerId: string, rtpCapabilities: any): Promise<string> {
		const id = await super.createConsumer(producerId, rtpCapabilities);

		this.socket.send(JSON.stringify({
			command: "consumerCreated",
			data: {
				producerId: producerId,
				consumerId: id,
				...this.media.consumerParameters(id)
			}
		}));

		return id
	}

	async deleteConsumer (id: string) {
		await super.deleteConsumer(id);

		this.socket.send(JSON.stringify({
			command: "consumerDeleted",
			data: { id }
		}));
	}

	async pauseConsumer (id: string) {
		await super.pauseConsumer(id);

		this.socket.send(JSON.stringify({
			command: "consumerPaused",
			data: { id }
		}));
	}

	async resumeConsumer (id: string) {
		await super.resumeConsumer(id);

		this.socket.send(JSON.stringify({
			command: "consumerResumed",
			data: { id }
		}));
	}
}