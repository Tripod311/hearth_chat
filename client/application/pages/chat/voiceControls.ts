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

	private _audioTrack?: MediaStreamTrack;
	private _videoTrack?: MediaStreamTrack;
	private pendingProducerRequest: { audio: boolean; video: boolean; } = { audio: false, video: false };
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
		this.onmessage({ command: "createTransport" });
	}

	deleteTransport () {
		this.onmessage({ command: "deleteTransport" });

		delete this._audioTrack;
		delete this._videoTrack;

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

		this.connected = true;

		this.onupdate && this.onupdate();

		this.createConsumers();
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

	async createProducer (kind: string) {
		if (kind === "audio") {
			this.producers.audio = await this.sendTransport.produce({ track: this._audioTrack });

			this.producers.audio.on("transportclose", this.producerDeleted.bind(this, { kind }));
		} else if (kind === "video") {
			this.producers.video = await this.sendTransport.produce({ track: this._videoTrack });

			this.producers.video.on("transportclose", this.producerDeleted.bind(this, { kind }));
		}
	}

	async deleteProducer (kind: string) {
		this.onmessage({
			command: "deleteProducer",
			data: { kind }
		});
	}

	producerCreated (data: { kind: string; id: string; }) {
		const cb = this.pending[`producer.${data.kind}`];
		cb && cb({ id: data.id });
		delete this.pending[`producer.${data.kind}`];

		this.pendingProducerRequest[data.kind] = false;

		this.onupdate && this.onupdate();
	}

	producerDeleted (data: { kind: string }) {
		if (data.kind === "audio") {
			this.producers.audio?.close();
			delete this.producers.audio;

			if (this._audioTrack !== undefined) this.createProducer("audio");
			else this.pendingProducerRequest[data.kind] = false;
		} else if (data.kind === "video") {
			this.producers.video.close();
			delete this.producers?.video;

			if (this._videoTrack !== undefined) this.createProducer("video");
			else this.pendingProducerRequest[data.kind] = false;
		}

		this.onupdate && this.onupdate();
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
			if (this._videoTrack) {
				return new MediaStream([this._videoTrack]);
			} else {
				return undefined;
			}
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

	get audioTrack (): MediaStreamTrack | undefined {
		return this._audioTrack;
	}

	get videoTrack (): MediaStreamTrack | undefined {
		return this._videoTrack;
	}

	set audioTrack (track: MediaStreamTrack | undefined) {
		if (!this.pendingProducerRequest.audio) {
			this.pendingProducerRequest.audio = true;

			if (this._audioTrack !== undefined) {
				this.deleteProducer("audio");
				this._audioTrack = track;
			} else {
				this._audioTrack = track;
				this.createProducer("audio");
			}
		}
	}

	set videoTrack (track: MediaStreamTrack | undefined) {
		if (!this.pendingProducerRequest.video) {
			this.pendingProducerRequest.video = true;

			if (this._videoTrack !== undefined) {
				this.deleteProducer("video");
				this._videoTrack = track;
			} else {
				this._videoTrack = track;
				this.createProducer("video");
			}
		}
	}
}