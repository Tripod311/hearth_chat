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

		// user actions

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

		this.instance.post("/api/getUsers", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.getUsers.bind(this)
		]));

		this.instance.post("/api/setPassword", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.setPassword.bind(this)
		]));

		this.instance.post("/api/addUser", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.addUser.bind(this)
		]));

		this.instance.post("/api/deleteUser", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.deleteUser.bind(this)
		]));

		this.instance.post("/api/editUser", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.editUser.bind(this)
		]));

		this.instance.post("/api/createInvite", this.baseChain.concat([
			this.verify.bind(this),
			this.createInvite.bind(this)
		]));

		this.instance.post("/api/acceptInvite", this.baseChain.concat([
			JsonBody,
			this.acceptInvite.bind(this)
		]));

		this.instance.get("/api/displayName", this.baseChain.concat([
			this.verify.bind(this),
			this.getDisplayName.bind(this)
		]));

		this.instance.post("/api/displayName", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.setDisplayName.bind(this)
		]));

		// topic actions

		this.instance.get("/api/myTopics", this.baseChain.concat([
			this.verify.bind(this),
			this.myTopics.bind(this)
		]));

		this.instance.get("/api/allTopics", this.baseChain.concat([
			this.verify.bind(this),
			this.allTopics.bind(this)
		]));

		this.instance.post("/api/createTopic", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.createTopic.bind(this)
		]));

		this.instance.post("/api/updateTopic", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.updateTopic.bind(this)
		]));

		this.instance.post("/api/deleteTopic", this.baseChain.concat([
			this.verify.bind(this),
			JsonBody,
			this.deleteTopic.bind(this)
		]));

		// node actions

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
							ctx.status(200).json({ error: false, data: { id: dbResponse.data.data.id, login: ctx.body.login, is_admin: dbResponse.data.data.is_admin, is_bot: dbResponse.data.data.is_bot }});
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

	getUsers (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				this.chain(this.dbAddress, {
					command: "getUsers",
					data: ctx.body
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

	setPassword (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			let login: string;

			if (ctx.locals.userInfo.is_admin && ctx.body.login) {
				login = ctx.body.login;
			} else {
				login = ctx.locals.userInfo.login;
			}

			this.chain(this.dbAddress, {
				command: "setPassword",
				data: { login: login, password: ctx.body.password }
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}
			});
		});
	}

	addUser (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				this.chain(this.dbAddress, {
					command: "addUser",
					data: ctx.body
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

	deleteUser (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				this.chain(this.dbAddress, {
					command: "deleteUser",
					data: ctx.body
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

	editUser (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				this.chain(this.dbAddress, {
					command: "editUser",
					data: ctx.body
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

	createInvite (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!ctx.locals.userInfo.is_admin) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				const inviteAddr = this.address!.parent.data;
				inviteAddr.push("invites");

				this.chain(inviteAddr, {
					command: "createInvite",
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

	acceptInvite (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			const inviteAddr = this.address!.parent.data;
			inviteAddr.push("invites");

			this.chain(inviteAddr, {
				command: "acceptInvite",
				data: ctx.body
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false });
				}
			});
		});
	}

	getDisplayName (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "getDisplayName",
				data: { id: ctx.locals.userInfo.id }
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}
			});
		});
	}

	setDisplayName (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "setDisplayName",
				data: { id: ctx.locals.userInfo.id, displayName: ctx.body.displayName }
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}
			});
		});
	}

	myTopics (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "getUserTopics",
				data: {
					id: ctx.locals.userInfo.id
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}
			});
		});
	}

	allTopics (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "getAllTopics",
				data: {}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false, data: response.data.data });
				}
			});
		});
	}

	createTopic (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "createTopic",
				data: {
					creator_id: ctx.locals.userInfo.id,
					title: ctx.body.title,
					description: ctx.body.description,
					guest_access: ctx.body.guest_access,
					author_write_only: ctx.body.author_write_only,
					password: ctx.body.password
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false });
				}
			});
		});
	}

	updateTopic (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			// check admin or owner

			this.chain(this.dbAddress, {
				command: "updateTopic",
				data: {
					userId: ctx.locals.userInfo.id,
					id: ctx.body.id,
					title: ctx.body.title,
					description: ctx.body.description,
					guest_access: ctx.body.guest_access,
					author_write_only: ctx.body.author_write_only,
					password: ctx.body.password
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false });
				}
			});
		});
	}

	deleteTopic (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			this.chain(this.dbAddress, {
				command: "deleteTopic",
				data: {
					userId: ctx.locals.userInfo.id,
					id: ctx.body.id
				}
			}, (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
				} else {
					ctx.status(200).json({ error: false });
				}
			});
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