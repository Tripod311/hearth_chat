import mediasoup from "mediasoup"
import { WebSocket } from "ws"
import { Log } from "@tripod311/dispatch"
import Actor from "./actor.js"
import type { ConsumerData } from "./actor.js"

export default class WSActor extends Actor {
	public kind: string = "ws";

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

		super.kill();
	}

	handleMessage (data: Buffer) {
		const raw = data.toString();

		try {
			console.log(raw);
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
					this.emit("createTransport");
					break;
				case "connectTransport":
					this.connectTransport(message.data);
					break;
				case "deleteTransport":
					this.deleteTransport();
					break;
				case "createProducer":
					this.createProducer(message.data.kind, message.data.rtpParameters);
					break;
				case "deleteProducer":
					this.deleteProducer(message.data.kind);
					break;
				case "createConsumer":
					this.createConsumer(message.data.actorId, message.data.kind);
					break;
				case "runConsumer":
					this.runConsumer(message.data.id);
				case "deleteConsumer":
					this.deleteConsumer(message.data.id);
					break;
			}
		} catch (err: any) {
			Log.warning("WS message error: " + err.toString(), 0);
		}
	}

	handleClose () {
		clearTimeout(this.timeout);
		this.deleteTransport();
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

	setSendTransport (transport: mediasoup.types.Transport) {
		super.setSendTransport(transport);

		this.socket.send(JSON.stringify({
			command: "transportCreated",
			data: {
				direction: "send",
				id: transport.id,
				iceParameters: (transport as mediasoup.types.WebRtcTransport).iceParameters,
				iceCandidates: (transport as mediasoup.types.WebRtcTransport).iceCandidates,
				dtlsParameters: (transport as mediasoup.types.WebRtcTransport).dtlsParameters
			}
		}));
	}

	setRecvTransport (transport: mediasoup.types.Transport) {
		super.setRecvTransport(transport);

		this.socket.send(JSON.stringify({
			command: "transportCreated",
			data: {
				direction: "recv",
				id: transport.id,
				iceParameters: (transport as mediasoup.types.WebRtcTransport).iceParameters,
				iceCandidates: (transport as mediasoup.types.WebRtcTransport).iceCandidates,
				dtlsParameters: (transport as mediasoup.types.WebRtcTransport).dtlsParameters
			}
		}));
	}

	setConsumer (id: string, consumer: ConsumerData) {
		super.setConsumer(id, consumer);

		this.socket.send(JSON.stringify({
			command: "consumerCreated",
			data: {
				actorId: consumer.actorId,
				kind: consumer.kind,
				consumerId: id,
				producerId: consumer.producerId,
				rtpParameters: consumer.consumer.rtpParameters
			}
		}));
	}

	async createProducer (kind: any, rtpParameters: any) {
		await super.createProducer(kind, rtpParameters);

		if (kind === "audio") {
			this.socket.send(JSON.stringify({
				command: "producerCreated",
				data: { kind: "audio", id: this.producers.audio!.id }
			}));
		} else if (kind === "video") {
			this.socket.send(JSON.stringify({
				command: "producerCreated",
				data: { kind: "video", id: this.producers.video!.id }
			}));
		}
	}

	async connectTransport (params: { id: any; dtlsParameters: any }) {
		if (this.sendTransport && this.sendTransport.id === params.id) {
			await this.sendTransport.connect({ dtlsParameters: params.dtlsParameters });
			this.socket.send(JSON.stringify({
				command: "transportConnected",
				data: { direction: 'send' }
			}));
		}

		if (this.recvTransport && this.recvTransport.id === params.id) {
			await this.recvTransport.connect({ dtlsParameters: params.dtlsParameters });
			this.socket.send(JSON.stringify({
				command: "transportConnected",
				data: { direction: 'recv' }
			}));
		}
	}
}