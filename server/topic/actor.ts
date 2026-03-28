import EventEmitter from "events"
import TopicMedia from "./topicMedia.js"

export default abstract class Actor extends EventEmitter {
	public authorized: boolean = false;
	public is_admin: boolean;
	public is_bot: boolean;
	public display_name: string;
	public id: number;
	public node_id: string | null;
	public node_user_id: number;

	public media!: TopicMedia;
	protected sendTransport?: string;
	protected recvTransport?: string;
	protected producers: { audio?: string; video?: string } = {};
	protected consumers: string[] = [];

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
		if (this.sendTransport !== undefined) this.media.deleteTransport(this.sendTransport);
		if (this.recvTransport !== undefined) this.media.deleteTransport(this.recvTransport);
	}

	async createSendTransport () {
		this.sendTransport = await this.media.createTransport("webrtc", {});
	}

	async deleteSendTransport () {
		if (this.sendTransport) {
			await this.media.deleteTransport(this.sendTransport);
			delete this.sendTransport;

			this.emit("mediaChange");
		}
	}

	async createRecvTransport () {
		this.recvTransport = await this.media.createTransport("webrtc", {});
	}

	async deleteRecvTransport () {
		if (this.recvTransport) {
			await this.media.deleteTransport(this.recvTransport);
			delete this.recvTransport;

			this.emit("mediaChange");
		}
	}

	async createProducer (kind: string, rtpParameters: any): Promise<string> {
		let result: string = "";

		if (kind === "audio") {
			if (this.producers.audio) {
				await this.deleteProducer("audio");
			}

			this.producers.audio = await this.media.createProducer(this.sendTransport!, "audio", rtpParameters, {
				transportclose: this.deleteProducer.bind(this, "audio")
			});

			this.emit("mediaChange");

			result = this.producers.audio as string;
		} else if (kind === "video") {
			if (this.producers.video) {
				await this.deleteProducer("video");
			}

			this.producers.video = await this.media.createProducer(this.sendTransport!, "video", rtpParameters, {
				transportclose: this.deleteProducer.bind(this, "video")
			});

			this.emit("mediaChange");

			result = this.producers.video as string;
		}

		return result;
	}

	async deleteProducer (kind: string) {
		if (kind === "audio" && this.producers.audio) {
			await this.media.deleteProducer(this.producers.audio);
			delete this.producers.audio;

			this.emit("mediaChange");
		} else if (kind === "video" && this.producers.video) {
			await this.media.deleteProducer(this.producers.video);
			delete this.producers.video;

			this.emit("mediaChange");
		}
	}

	async pauseProducer (kind: string) {
		if (kind === "audio" && this.producers.audio) {
			await this.media.pauseProducer(this.producers.audio);
		} else if (kind === "video" && this.producers.video) {
			await this.media.pauseProducer(this.producers.video);
		}
	}

	async resumeProducer (kind: string) {
		if (kind === "audio" && this.producers.audio) {
			await this.media.resumeProducer(this.producers.audio);
		} else if (kind === "video" && this.producers.video) {
			await this.media.resumeProducer(this.producers.video);
		}
	}

	async createConsumer (producerId: string, rtpCapabilities: any): Promise<string> {
		const id = await this.media.createConsumer(this.recvTransport!, producerId, rtpCapabilities, {
			transportclose: this.deleteConsumer.bind(this),
			producerclose: this.deleteConsumer.bind(this)
		});

		this.consumers.push(id);

		return id;
	}

	async deleteConsumer (id: string) {
		await this.media.deleteConsumer(id);

		this.consumers = this.consumers.filter(c => c !== id);
	}

	async pauseConsumer (id: string) {
		await this.media.pauseConsumer(id);
	}

	async resumeConsumer (id: string) {
		await this.media.resumeConsumer(id);
	}

	get mediaState (): { display_name: string; audio?: string; video?: string; } | undefined {
		if (this.sendTransport && this.recvTransport) {
			return {
				display_name: this.display_name,
				audio: this.producers.audio,
				video: this.producers.video
			}
		} else {
			return undefined;
		}
	}

	abstract proxy (data: string): void;
}