import mediasoup from "mediasoup"
import EventEmitter from "events"

export interface ConsumerData {
	consumer: mediasoup.types.Consumer;
	producerId: string;
	actorId: number;
	kind: string;
}

export default abstract class Actor extends EventEmitter {
	public kind: string = "";

	public authorized: boolean = false;
	public is_admin: boolean;
	public is_bot: boolean;
	public display_name: string;
	public id: number;
	public node_id: string | null;
	public node_user_id: number;

	protected transportConnected: boolean = false;
	protected sendTransport?: mediasoup.types.Transport;
	protected recvTransport?: mediasoup.types.Transport;
	protected producers: { audio?: mediasoup.types.Producer; video?: mediasoup.types.Producer } = {};
	protected consumers: Record<string, ConsumerData> = {};

	constructor (is_admin: boolean, is_bot: boolean, display_name: string, id: number, node_id: string | null, node_user_id: number) {
		super();

		this.is_admin = is_admin;
		this.is_bot = is_bot;
		this.display_name = display_name;
		this.id = id;
		this.node_id = node_id;
		this.node_user_id = node_user_id;
	}

	kill () {
		this.producers.audio?.close();
		this.producers.video?.close();

		this.sendTransport?.close();
		this.recvTransport?.close();
	}

	setSendTransport (transport: mediasoup.types.Transport) {
		this.sendTransport = transport;

		if (this.sendTransport && this.recvTransport) {
			this.transportConnected = true;

			this.updateMediaState();
		}
	}

	setRecvTransport (transport: mediasoup.types.Transport) {
		this.recvTransport = transport;

		if (this.sendTransport && this.recvTransport) {
			this.transportConnected = true;

			this.updateMediaState();
		}
	}

	async deleteTransport () {
		this.producers.audio?.close();
		this.producers.video?.close();

		if (this.sendTransport) {
			await this.sendTransport.close();
			delete this.sendTransport;
		}

		if (this.recvTransport) {
			await this.recvTransport.close();
			delete this.recvTransport;
		}

		this.transportConnected = false;

		this.updateMediaState();
	}

	async createProducer (kind: any, rtpParameters: any): Promise<void> {
		if (kind === "audio") {
			this.producers.audio?.close();

			this.producers.audio = await this.sendTransport!.produce({
				kind,
				rtpParameters
			});
		} else if (kind === "video") {
			this.producers.video?.close();

			this.producers.video = await this.sendTransport!.produce({
				kind,
				rtpParameters
			});
		}

		this.updateMediaState();
	}

	createConsumer (actorId: number, kind: string) {
		this.emit("createConsumer", {
			actorId,
			kind
		});
	}

	setConsumer (id: string, consumer: ConsumerData) {
		this.consumers[id] = consumer;

		consumer.consumer.on("producerclose", this.deleteConsumer.bind(this, id));
		consumer.consumer.on("transportclose", this.deleteConsumer.bind(this, id));
	}

	deleteConsumer (id: string) {
		this.consumers[id]?.consumer.close();

		delete this.consumers[id];
	}

	async runConsumer (id: string) {
		await this.consumers[id]?.consumer.resume();
	}

	deleteProducer (kind: any) {
		if (kind === "audio") {
			this.producers.audio?.close();
			delete this.producers.audio;
		} else if (kind === "video") {
			this.producers.video?.close();
			delete this.producers.video;
		}

		this.updateMediaState();
	}

	updateMediaState () {
		this.emit("mediaChange", {
			connected: this.transportConnected,
			audio: !!this.producers.audio,
			video: !!this.producers.video
		});
	}

	get transports (): { send: mediasoup.types.Transport; recv: mediasoup.types.Transport; } | null {
		if (!this.sendTransport || !this.recvTransport) return null;

		return {
			send: this.sendTransport,
			recv: this.recvTransport
		}
	}

	get audioProducer (): mediasoup.types.Producer | null {
		return this.producers.audio || null;
	}

	get videoProducer (): mediasoup.types.Producer | null {
		return this.producers.video || null;
	}

	abstract proxy (data: string): void;
}