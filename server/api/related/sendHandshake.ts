import http from "http"
import https from "https"
import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

function requestNode(link: string, payload: any): Promise<any> {
	return new Promise((resolve, reject) => {
		const url = new URL(link + "/api/handshake");

		const isHttps = url.protocol === "https:";

		const lib = isHttps ? https : http;

		const data = JSON.stringify(payload);

		const options = {
			hostname: url.hostname,
			port: url.port || (isHttps ? 443 : 80),
			path: url.pathname + url.search,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(data)
			}
		};

		const req = lib.request(options, (res) => {
			const ip = res.socket.remoteAddress;
			
			let body = "";

			res.on("data", (chunk) => {
				body += chunk;
			});

			res.on("end", () => {
				try {
					const result = JSON.parse(body);

					resolve({
						result,
						ip
					});
				} catch (err) {
					reject(err);
				}
			});
		});

		req.on("error", reject);

		req.write(data);
		req.end();
	});
}

export default function sendHandshake (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!ctx.locals.userInfo.is_admin) {
			ctx.status(403).json({ error: true, details: "Access forbidden" });

			resolve();
		} else {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "getNodeSettings",
				data: {}
			}, async (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
					resolve();
					return;
				}

				try {
					const payload = {
						message: ctx.body.message,
						uuid: response.data.data.uuid,
						title: response.data.data.title,
						description: response.data.data.description,
						port: response.data.data.gate_port
					};

					const { result, ip } = await requestNode(ctx.body.link, payload);

					if (result.error) throw new Error(result.details);

					this.chain(dbAddress, {
						command: "addRelated",
						data: {
							uuid: result.data.uuid,
							title: result.data.title,
							description: result.data.description,
							port: result.data.port,
							ip: ip
						}
					}, (writeResponse: Event) => {
						if (writeResponse.data.error) {
							ctx.status(500).json({ error: true, details: writeResponse.data.details });
						} else {
							ctx.status(200).json({ error: false });
						}

						resolve();
					});
				} catch (err: any) {
					ctx.status(500).json({ error: true, details: err.toString() })

					resolve();
				}
			});
		}
	});
}