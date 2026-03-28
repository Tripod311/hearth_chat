import mediasoup from "mediasoup"
import MediasoupController from "../mediasoupController.js"

type TransportHandleName = 'routerclose';
type ProducerHandleName = 'transportclose';
type ConsumerHandleName = 'transportclose' | 'producerclose';
type TransportHandles = Partial<Record<TransportHandleName, (id: string) => void>>;
type ProducerHandles = Partial<Record<ProducerHandleName, (id: string) => void>>;
type ConsumerHandles = Partial<Record<ConsumerHandleName, (id: string) => void>>;

export default class TopicMedia {
	private router: mediasoup.types.Router;
	private transports: Record<string, mediasoup.types.Transport> = {};
	private producers: Record<string, mediasoup.types.Producer> = {};
	private consumers: Record<string, mediasoup.types.Consumer> = {};

	constructor (router: mediasoup.types.Router) {
		this.router = router;
	}

	async createTransport (type: string, handles: TransportHandles): Promise<string> {
		let result: string = "";

		if (type === "webrtc") {
			const transport = await this.router.createWebRtcTransport({
				listenIps: [{ ip: "0.0.0.0", announcedIp: MediasoupController.announced_ip || undefined }],
				enableUdp: true,
				enableTcp: true,
				preferUdp: true
			});

			this.transports[transport.id] = transport;
			if (handles['routerclose']) {
				const cb = handles['routerclose'];

				transport.on('routerclose', () => {
					cb(transport.id);
				});
			}

			result = transport.id;
		}

		return result;
	}

	webrtcTransportInfo (id: string): { iceParameters: any; iceCandidates: any; dtlsParameters: any } {
		if (!this.transports[id]) throw new Error("Transport not found");

		return {
			iceParameters: (this.transports[id] as mediasoup.types.WebRtcTransport).iceParameters,
			iceCandidates: (this.transports[id] as mediasoup.types.WebRtcTransport).iceCandidates,
			dtlsParameters: (this.transports[id] as mediasoup.types.WebRtcTransport).dtlsParameters
		}
	}

	consumerParameters (id: string): { rtpParameters: any; kind: mediasoup.types.MediaKind; } {
		if (!this.consumers[id]) throw new Error("Consumer not found");

		return {
			rtpParameters: this.consumers[id]!.rtpParameters,
			kind: this.consumers[id]!.kind
		}
	}

	async deleteTransport (id: string) {
		if (!this.transports[id]) return;

		await this.transports[id].close();
		delete this.transports[id];
	}

	async connectTransport (id: string, dtlsParameters: any) {
		if (!this.transports[id]) throw new Error("Transport not found");

		await this.transports[id]!.connect({ dtlsParameters });
	}

	async createProducer (transportId: string, kind: string, rtpParameters: any, handles: ProducerHandles): Promise<string> {
		if (!this.transports[transportId]) throw new Error("Transport not found");

		const producer = await this.transports[transportId]!.produce({
			kind: kind as mediasoup.types.MediaKind,
			rtpParameters: rtpParameters
		});

		this.producers[producer.id] = producer;
		if (handles['transportclose']) {
			const cb = handles['transportclose'];

			producer.on('transportclose', () => {
				cb(producer.id);
			});
		}

		return producer.id;
	}

	async deleteProducer (id: string) {
		if (!this.producers[id]) return;

		await this.producers[id]!.close();
		delete this.producers[id];
	}

	async pauseProducer (id: string) {
		if (!this.producers[id]) throw new Error("Producer not found");

		await this.producers[id].pause();
	}

	async resumeProducer (id: string) {
		if (!this.producers[id]) throw new Error("Producer not found");

		await this.producers[id].resume();
	}

	async createConsumer (transportId: string, producerId: string, rtpCapabilities: any, handles: ConsumerHandles): Promise<string> {
		if (!this.transports[transportId]) throw new Error("Transport not found");

		if (!this.router.canConsume({ producerId, rtpCapabilities })) throw new Error("Can't consume");

		const consumer = await this.transports[transportId]!.consume({
			producerId: producerId,
			rtpCapabilities: rtpCapabilities,
			paused: true
		});

		this.consumers[consumer.id] = consumer;
		if (handles['transportclose']) {
			const cb = handles['transportclose'];

			consumer.on('transportclose', () => {
				cb(consumer.id);
			});
		}
		if (handles['producerclose']) {
			const cb = handles['producerclose'];

			consumer.on('producerclose', () => {
				cb(consumer.id);
			});
		}

		return consumer.id;
	}

	async deleteConsumer (id: string) {
		if (!this.consumers[id]) return;

		await this.consumers[id]!.close();
		delete this.consumers[id];
	}

	async pauseConsumer (id: string) {
		if (!this.consumers[id]) throw new Error("Consumer not found");

		await this.consumers[id].pause();
	}

	async resumeConsumer (id: string) {
		if (!this.consumers[id]) throw new Error("Consumer not found");

		await this.consumers[id].resume();
	}
}