import { Device, SendTransport, RecvTransport, Producer, Consumer } from "mediasoup-client"

type ChatState = Record<number, { display_name: string; audio: boolean; video: boolean; }>;

export default class VoiceControls {
	public iceServers: any;
	public selfId: number;

	private device: Device;
	private sendTransport?: SendTransport;
	private recvTransport?: RecvTransport;

	private stream?: MediaStream;
	private producers: { audio?: Producer; video?: Producer; } = {};
	private consumers: Record<number, { audio?: Consumer; video?: Consumer; }> = {};
	private promises: { recvTransport?: () => void; sendTransport?: () => void; audio?: (id: string) => string; video?: (id: string) => string; } = {};

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

		this.producers.audio?.close();
		this.producers.video?.close();
		this.producers = {};

		this.sendTransport?.close();
		this.recvTransport?.close();
		delete this.sendTransport;
		delete this.recvTransport;
		this.connected = false;

		this.onupdate && this.onupdate();
	}

	async transportCreated (data: { direction: 'recv' | 'send'; id: any; iceParameters: any; iceCandidates: any; dtlsParameters: any }) {
		if (data.direction === 'recv') {
			this.recvTransport = this.device.createRecvTransport({
				iceServers: this.iceServers,
				id: data.id,
				iceParameters: data.iceParameters,
				iceCandidates: data.iceCandidates,
				dtlsParameters: data.dtlsParameters
			});
			this.recvTransport.on('connect', (data: any, callback: any, errback: any) => {
				this.onmessage({
					command: "connectTransport",
					data: {
						id: this.recvTransport.id,
						dtlsParameters: data.dtlsParameters
					}
				});
				
				this.promises.recvTransport = callback;
			});
			this.recvTransport.on("connectionstatechange", this.transportStateChange.bind(this));
		} else if (data.direction === 'send') {
			this.sendTransport = this.device.createSendTransport({
				iceServers: this.iceServers,
				id: data.id,
				iceParameters: data.iceParameters,
				iceCandidates: data.iceCandidates,
				dtlsParameters: data.dtlsParameters
			});
			this.sendTransport.on('connect', (data: any, callback: any, errback: any) => {
				this.onmessage({
					command: "connectTransport",
					data: {
						id: this.sendTransport.id,
						dtlsParameters: data.dtlsParameters
					}
				});
				
				this.promises.sendTransport = callback;
			});
			this.sendTransport.on('produce', (data: any, callback: any, errback: any) => {
				this.onmessage({
					command: "createProducer",
					data: {
						kind: data.kind,
						rtpParameters: data.rtpParameters
					}
				});

				this.promises[data.kind] = callback;
			});
			this.sendTransport.on("connectionstatechange", this.transportStateChange.bind(this));
		}

		if (this.recvTransport && this.sendTransport) {
			await this.createProducers();
		}
	}

	transportStateChange (state) {
		switch (state) {
			case "closed":
			case "failed":
			case "disconnected":
				this.deleteTransport();
				break;
		}
	}

	transportConnected (data: { direction: 'send' | 'recv' }) {
		if (data.direction === 'send') {
			this.promises.sendTransport();
			this.connected = true;

			this.onupdate && this.onupdate();

			this.createConsumers();
		} else if (data.direction === 'recv') {
			this.promises.recvTransport();
		}
	}

	mediaUpdate (state: ChatState) {
		this.state = state;

		this.onupdate && this.onupdate();
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
			if (this.state[id].audio && !this.consumers[id].audio) {
				this.onmessage!({
					command: "createConsumer",
					data: {
						actorId: actorId,
						kind: "audio"
					}
				});
			}
			if (this.state[id].video && !this.consumers[id].video) {
				this.onmessage!({
					command: "createConsumer",
					data: {
						actorId: actorId,
						kind: "video"
					}
				});
			}
		}
	}

	producerCreated (data: { kind: string; id: string; }) {
		this.promises[data.kind]({ id: data.id });
	}

	async consumerCreated (data: { actorId: number; consumerId: string; producerId: string; kind: string; rtpParameters: any; }) {
		const consumer = await this.recvTransport!.consume({
			id: data.consumerId,
			producerId: data.producerId,
			kind: data.kind,
			rtpParameters: data.rtpParameters
		});

		this.consumers[data.actorId][data.kind] = consumer;

		consumer.on("producerclose", () => {
			consumer.close();
			delete this.consumers[data.actorId][data.kind];
		});
		consumer.on("transportclose", () => {
			consumer.close();
			delete this.consumers[data.actorId][data.kind];
		});

		this.onmessage!({
			command: "runConsumer",
			data: { id: data.consumerId }
		});

		this.onconsumerready && this.onconsumerready(data.consumerId, data.kind);
	}

	getAudioStream (id: string): MediaStream | undefined {
		if (id === this.selfId.toString()) {
			// return this.stream;
			return null;
		} else {
			if (this.consumers[id] && this.consumers[id].audio) {
				return new MediaStream([this.consumers[id].audio.track]);
			}

			return undefined;
		}
	}

	getVideoStream (id: string): MediaStream | undefined {
		if (id === this.selfId.toString()) {
			return this.stream;
		} else {
			if (this.consumers[id] && this.consumers[id].video) {
				return new MediaStream([this.consumers[id].video.track]);
			}

			return undefined;
		}
	}
}