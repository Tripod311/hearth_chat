import { Device, SendTransport, RecvTransport, Producer, Consumer } from "mediasoup-client"

interface TransportInfo {
	id: string;
	iceCandidates: any;
	iceParameters: any;
	dtlsParameters: any;
}

type ChatState = Record<number, { display_name: string; audio?: string; video?: string; }>;

export default class VoiceControls {
	public iceServers: any;
	public selfId: number;

	private device: Device;
	private sendTransport?: SendTransport;
	private recvTransport?: RecvTransport;

	private stream?: MediaStream;
	private producers: { audio?: Producer; video?: Producer; } = {};
	private consumers: Record<string, Consumer> = {};
	private producerConsumerMap: Record<string, string> = {};
	private pending: Record<string, (data:any) => void> = {};

	public connected: boolean = false;
	public state: ChatState = {};
	public onupdate?: () => void;
	public onconsumerready?: (id: number, kind: string) => void;
	public onmessage!: (msg: { command: string; data: any }) => void;

	constructor () {
		this.createDevice();
	}

	async createDevice () {
		this.device = await Device.factory();
	}

	async load (rtpCapabilities: any) {
		await this.device.load({ routerRtpCapabilities: rtpCapabilities });
	}

	createTransport (stream: MediaStream) {
		this.stream = stream;

		this.onmessage({ command: "createTransport" });
	}

	deleteTransport () {
		this.onmessage({ command: "deleteTransport" });

		this.producers = {};
		this.consumers = {};

		this.sendTransport?.close();
		this.recvTransport?.close();
		delete this.sendTransport;
		delete this.recvTransport;
		this.connected = false;

		this.onupdate && this.onupdate();
	}

	async transportCreated (data: { send: TransportInfo; recv: TransportInfo; }) {
		this.recvTransport = this.device.createRecvTransport({
			iceServers: this.iceServers,
			id: data.recv.id,
			iceParameters: data.recv.iceParameters,
			iceCandidates: data.recv.iceCandidates,
			dtlsParameters: data.recv.dtlsParameters
		});
		this.recvTransport.on('connect', (data: any, callback: any, errback: any) => {
			this.onmessage({
				command: "connectTransport",
				data: {
					id: this.recvTransport.id,
					dtlsParameters: data.dtlsParameters
				}
			});
			
			this.pending["recvTransport"] = callback;
		});
		this.recvTransport.on("connectionstatechange", this.transportStateChange.bind(this, "recv"));

		this.sendTransport = this.device.createSendTransport({
			iceServers: this.iceServers,
			id: data.send.id,
			iceParameters: data.send.iceParameters,
			iceCandidates: data.send.iceCandidates,
			dtlsParameters: data.send.dtlsParameters
		});
		this.sendTransport.on('connect', (data: any, callback: any, errback: any) => {
			this.onmessage({
				command: "connectTransport",
				data: {
					id: this.sendTransport.id,
					dtlsParameters: data.dtlsParameters
				}
			});
			
			this.pending["sendTransport"] = callback;
		});
		this.sendTransport.on('produce', (data: any, callback: any, errback: any) => {
			this.onmessage({
				command: "createProducer",
				data: {
					kind: data.kind,
					rtpParameters: data.rtpParameters
				}
			});

			this.pending[`producer.${data.kind}`] = callback;
		});
		this.sendTransport.on("connectionstatechange", this.transportStateChange.bind(this, "send"));

		await this.createProducers();
	}

	transportStateChange (tag: string, state: any) {
		switch (state) {
			case "connected":
				console.log(`TRANSPORT CONNECTED (${tag})`);
				break;
			case "closed":
			case "failed":
			case "disconnected":
				this.deleteTransport();
				break;
		}
	}

	transportConnected (data: { id: string }) {
		if (data.id === this.sendTransport.id) {
			this.pending["sendTransport"]();
			delete this.pending["sendTransport"];
			this.connected = true;

			this.onupdate && this.onupdate();

			this.createConsumers();
		} else if (data.id === this.recvTransport.id) {
			this.pending["recvTransport"]();
			delete this.pending["recvTransport"];
		}
	}

	mediaUpdate (state: ChatState) {
		this.state = state;

		this.onupdate && this.onupdate();

		if (this.connected) this.createConsumers();
	}

	async createProducers () {
		const videoTrack = this.stream!.getVideoTracks()[0];
		const audioTrack = this.stream!.getAudioTracks()[0];

		if (audioTrack) {
			this.producers.audio = await this.sendTransport.produce({ track: audioTrack });
		}
		if (videoTrack) {
			this.producers.video = await this.sendTransport.produce({ track: videoTrack });
		}	
	}

	createConsumers () {
		for (const id in this.state) {
			if (id === this.selfId.toString()) continue;

			if (this.state[id].audio) {
				const producerId = this.state[id].audio;

				if (!this.producerConsumerMap[producerId]) {
					this.producerConsumerMap[producerId] = "audio";

					this.onmessage!({
						command: "createConsumer",
						data: {
							producerId: producerId,
							rtpCapabilities: this.device.rtpCapabilities
						}
					});
				}
			}

			if (this.state[id].video) {
				const producerId = this.state[id].video;

				if (!this.producerConsumerMap[producerId]) {
					this.producerConsumerMap[producerId] = "video";

					this.onmessage!({
						command: "createConsumer",
						data: {
							producerId: producerId,
							rtpCapabilities: this.device.rtpCapabilities
						}
					});
				}
			}
		}
	}

	producerCreated (data: { kind: string; id: string; }) {
		const cb = this.pending[`producer.${data.kind}`];
		cb && cb({ id: data.id });
		delete this.pending[`producer.${data.kind}`];
	}

	async consumerCreated (data: { consumerId: string; producerId: string; kind: string; rtpParameters: any; }) {
		const consumer = await this.recvTransport!.consume({
			id: data.consumerId,
			producerId: data.producerId,
			kind: data.kind,
			rtpParameters: data.rtpParameters
		});

		this.producerConsumerMap[data.producerId] = data.consumerId;
		this.consumers[data.consumerId] = consumer;

		consumer.on("producerclose", () => {
			consumer.close();
			delete this.consumers[data.consumerId];
			delete this.producerConsumerMap[data.producerId];
		});
		consumer.on("transportclose", () => {
			consumer.close();
			delete this.consumers[data.consumerId];
			delete this.producerConsumerMap[data.producerId];
		});

		this.onmessage!({
			command: "resumeConsumer",
			data: { id: data.consumerId }
		});
	}

	async consumerResumed (data: { id: string; }) {
		if (this.consumers[data.id]) {
			await this.consumers[data.id].resume();

			this.onconsumerready && this.onconsumerready(data.id);
		}
	}

	getAudioStream (id: string): MediaStream | undefined {
		if (id === this.selfId.toString()) {
			// return this.stream;
			return undefined;
		} else {
			const producerId = this.state[id].audio;

			if (!producerId) return undefined;

			const consumerId = this.producerConsumerMap[producerId];

			if (!consumerId) return undefined;

			const consumer = this.consumers[consumerId];

			if (!consumer) return undefined;

			return new MediaStream([consumer.track]);
		}
	}

	getVideoStream (id: string): MediaStream | undefined {
		if (id === this.selfId.toString()) {
			return this.stream;
		} else {
			const producerId = this.state[id].video;

			if (!producerId) return undefined;

			const consumerId = this.producerConsumerMap[producerId];

			if (!consumerId) return undefined;

			const consumer = this.consumers[consumerId];

			if (!consumer) return undefined;

			return new MediaStream([consumer.track]);
		}
	}
}