import path from "path"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import { Currents, SetCookie, ParseCookies, Cors, SecurityHeaders, ServeStatic, JsonBody, StreamingMultipartBody, Context } from "@tripod311/currents"
import type { CorsOptions, CurrentsOptions, RouteHandler } from "@tripod311/currents"

export default class API extends Node {
	private instance: Currents;
	private baseChain: RouteHandler[];
	private port: number;
	private uuid: string;

	private accessAddress!: Address;
	private dbAddress!: Address;
	private gateAddress!: Address;

	constructor (port: number, uuid: string) {
		super();

		this.uuid = uuid;
		this.port = port;

		let certificates: { key: string; cert: string; ca?: string; } | undefined;

		this.instance = Currents.fromOptions({
			certificates: certificates
		});

		this.baseChain = [
			SecurityHeaders({
				transportSecurity: {
					maxAge: 31536000,
					includeSubDomains: true
				},
				contentTypeOptions: true,
				xFrameOptions: 'DENY'
			}),
			ParseCookies()
		]

		// add routes

		this.instance.get('/*', this.baseChain
			.concat([
				ServeStatic({
					basePath: "/",
					rootDir: path.join(process.cwd(), 'client_dist'),
					cacheControl: ["public", "max-age=0"],
					fallback: "index.html"
				})
			])
		);

		this.instance.get('/files/*', this.baseChain
			.concat([
				ServeStatic({
					basePath: "/",
					rootDir: path.join(process.cwd(), 'data/files'),
					cacheControl: ["public", "max-age=31536000", "immutable"]
				})
			])
		);

		this.instance.post("/api/verify", this.baseChain.concat([
			this.verify.bind(this),
			async (ctx: Context) => {
				ctx.status(200).json({ error: false, userInfo: ctx.locals.userInfo });
			}
		]));
		this.instance.post("/api/login", this.baseChain.concat([
			JsonBody,
			this.login.bind(this)
		]));
		this.instance.post("/api/logout", this.baseChain.concat([
			this.logout.bind(this)
		]));

		this.instance.post("/api/titlePage", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.fetchTitlePage.bind(this)
		]));

		this.instance.get("/api/nodeSettings", this.baseChain.concat([
			this.verify.bind(this),
			this.getNodeSettings.bind(this)
		]));

		this.instance.post("/api/nodeSettings", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.setNodeSettings.bind(this)
		]));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		const access = this.address!.parent.data;
		access.push("access");
		const db = this.address!.parent.data;
		db.push("db");
		const gate = this.address!.parent.data;
		gate.push("gate");
		this.accessAddress = new Address(access);
		this.dbAddress = new Address(db);
		this.gateAddress = new Address(gate);

		this.instance.server.listen(this.port, () => {
			Log.success("Node listening on " + this.port, 0);
		})
	}

	detach () {
		this.instance.server.close();

		super.detach();
	}

	login (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "authUser",
				data: ctx.body
			}, (dbResponse: Event) => {
				if (dbResponse.data.error) {
					ctx.status(403).json({ error: true, details: dbResponse.data.details });

					resolve();
				} else {
					this.chain(this.accessAddress, {
						command: "generateToken",
						data: dbResponse.data.data
					}, (accessResponse: Event) => {
						if (accessResponse.data.error) {
							ctx.status(500).json({ error: true, details: "Internal error: " + accessResponse.data.details });
						} else {
							SetCookie(ctx, "hearthchat_token", accessResponse.data.data.token, {
								httpOnly: true,
								sameSite: "Strict",
								maxAge: 60 * 60 * 24
							});
							ctx.status(200).json({ error: false, data: { login: ctx.body.login, is_admin: dbResponse.data.data.is_admin, is_bot: dbResponse.data.data.is_bot }});
						}

						resolve();
					})
				}
			});
		});
	}

	async logout (ctx: Context) {
		SetCookie(ctx, "hearthchat_token", "", {
			httpOnly: true,
			sameSite: "Strict",
			maxAge: 0
		});

		ctx.status(200).json({ error: false });
	}

	verify (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			const token = ctx.cookies["hearthchat_token"];

			this.chain(this.accessAddress, {
				command: "verifyToken",
				data: {
					token: token
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(403).json({ error: true, details: "Access forbidden" });
				} else {
					if (response.data.data.refreshToken) {
						SetCookie(ctx, "hearthchat_token", response.data.data.refreshToken, {
							httpOnly: true,
							sameSite: "Strict",
							maxAge: 60 * 60 * 24
						});
					}

					ctx.locals.userInfo = response.data.data.payload;
				}

				resolve();
			})
		});
	}

	fetchTitlePage (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			const nodeId = ctx.body.nodeId;

			if (nodeId === "self") {
				this.chain(this.dbAddress, {
					command: "fetchTitle",
					data: {}
				}, (response: Event) => {
					if (response.data.error) {
						ctx.status(404).json({ error: true, details: response.data.details });
					} else {
						ctx.status(200).json({ error: false, data: response.data.data });
					}
				});
			} else {
				this.chain(this.gateAddress, {
					command: "fetchTitle",
					data: {
						nodeId: nodeId
					}
				}, (response: Event) => {
					if (response.data.error) {
						ctx.status(404).json({ error: true, details: response.data.details });
					} else {
						ctx.status(200).json({ error: false, data: response.data.data });
					}
				});
			}
		});
	}

	getNodeSettings (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				this.chain(this.dbAddress, {
					command: "getNodeSettings",
					data: {}
				}, (response: Event) => {
					if (response.data.error) {
						ctx.status(500).json({ error: true, details: response.data.details });
					} else {
						ctx.status(200).json({ error: false, data: response.data.data });
					}
				});
			}
		});
	}

	setNodeSettings (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				this.chain(this.dbAddress, {
					command: "setNodeSettings",
					data: ctx.body
				}, (response: Event) => {
					if (response.data.error) {
						ctx.status(500).json({ error: true, details: response.data.details });
					} else {
						ctx.status(200).json({ error: false });
					}
				});
			}
		});
	}
}