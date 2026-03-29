import mediasoup from "mediasoup"

export default class MediasoupController {
	public static announced_ip: string | undefined;
	public static ice_candidates: string | undefined;
	public static codecs: any = [
		{
			kind: "audio",
			mimeType: "audio/opus",
			clockRate: 48000,
			channels: 2
		},
		{
			kind: "video",
			mimeType: "video/VP8",
			clockRate: 90000,
			parameters: {}
		},
		{
			kind: "video",
			mimeType: "video/H264",
			clockRate: 90000,
			parameters: {
				"packetization-mode": 1,
				"profile-level-id": "42e01f",
				"level-asymmetry-allowed": 1
			}
		}
	];
	private static worker?: mediasoup.types.Worker;
	private static routers: Record<number, mediasoup.types.Router> = {};

	static async setup () {
		const portBase = process.env.PORT_BASE ? parseInt(process.env.PORT_BASE) : 40000;
		const portRange = process.env.PORT_RANGE ? parseInt(process.env.PORT_RANGE) : 9999;

		MediasoupController.worker = await mediasoup.createWorker({
			rtcMinPort: portBase,
			rtcMaxPort: portBase + portRange
		});
	}

	static async shutdown () {
		await MediasoupController.worker?.close();
	}

	static async createRouter (id: number): Promise<mediasoup.types.Router> {
		if (MediasoupController.worker) {
			const router = await MediasoupController.worker.createRouter({ mediaCodecs: MediasoupController.codecs });
			MediasoupController.routers[id] = router;
			return router;
		} else {
			throw new Error("Mediasoup worker not started");
		}
	}

	static async getRouter (id: number): Promise<mediasoup.types.Router | null> {
		return MediasoupController.routers[id] || null;
	}

	static async closeRouter (id: number) {
		if (MediasoupController.routers[id]) MediasoupController.routers[id].close();
	}
}