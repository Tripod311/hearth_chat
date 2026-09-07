import crypto from "crypto"
import path from "path"
import FS from "fs"
import { Socket } from "net"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import { Currents, ParseCookies, Cors, SecurityHeaders, JsonBody, Context } from "@tripod311/currents"
import { NodeAdapter, StreamingMultipartBody, ServeStatic } from "@tripod311/currents/node"
import type { CorsOptions, RouteHandler } from "@tripod311/currents"
import type { CurrentsOptions } from "@tripod311/currents/node"
import { WebSocketServer, WebSocket } from "ws"
import { parse } from "url"

import login from "./api/user/login.js"
import logout from "./api/user/logout.js"
import verify from "./api/user/verify.js"
import getUsers from "./api/user/getUsers.js"
import setPassword from "./api/user/setPassword.js"
import addUser from "./api/user/addUser.js"
import deleteUser from "./api/user/deleteUser.js"
import editUser from "./api/user/editUser.js"
import createInvite from "./api/user/createInvite.js"
import acceptInvite from "./api/user/acceptInvite.js"
import getDisplayName from "./api/user/getDisplayName.js"
import setDisplayName from "./api/user/setDisplayName.js"

import myTopics from "./api/topic/myTopics.js"
import allTopics from "./api/topic/allTopics.js"
import createTopic from "./api/topic/createTopic.js"
import updateTopic from "./api/topic/updateTopic.js"
import deleteTopic from "./api/topic/deleteTopic.js"
import uploadFiles from "./api/topic/uploadFiles.js"

import fetchTitlePage from "./api/node/fetchTitlePage.js"
import getNodeSettings from "./api/node/getNodeSettings.js"
import setNodeSettings from "./api/node/setNodeSettings.js"
import fetchVapid from "./api/node/fetchVapid.js"
import fetchNodeTitle from "./api/node/fetchNodeTitle.js"
import fetchLocales from "./api/node/locales.js"

import nodeHandshake from "./api/related/nodeHandshake.js"
import fetchRelated from "./api/related/fetchRelated.js"
import fetchHandshakes from "./api/related/fetchHandshakes.js"
import acceptHandshake from "./api/related/acceptHandshake.js"
import rejectHandshake from "./api/related/rejectHandshake.js"
import sendHandshake from "./api/related/sendHandshake.js"
import forgetRelated from "./api/related/forgetRelated.js"
import goTo from "./api/related/goTo.js"
import getFile from "./api/related/getFile.js"

import addPushSubscription from "./api/push/addPushSubscription.js"
import deletePushSubscription from "./api/push/deletePushSubscription.js"

import getActors from "./api/actor/getActors.js"
import getActorInfo from "./api/actor/getActorInfo.js"
import banActor from "./api/actor/ban.js"
import unbanActor from "./api/actor/unban.js"

const MP_OPTS = {
	tmpDir: "./data/tmp",
	maxRequestSize: 1024 * 1024 * 105,
    maxFileSize: 1024 * 1024 * 100,
    maxFieldSize: 1024 * 1024 * 10,
    maxPartHeaderSize: 1024 * 16,
    maxParts: 50,
    maxFiles: 10,
    requestTimeout: 1000 * 60 * 5,
    chunkTimeout: 1000 * 30
}

interface WSOptions {
	socket?: WebSocket;
	timeout?: ReturnType<typeof setTimeout>;
	is_admin: boolean;
	is_bot: boolean;
	user_id: number;
	topic_id: number;
	topic_node: string;
}

export default class API extends Node {
	private wsServer: WebSocketServer;
	private wsConnections: Record<string, WSOptions> = {};
	private sockets: Set<Socket> = new Set();

	private instance: Currents;
	private baseChain: RouteHandler[];
	private port: number;
	public uuid: string;

	constructor (port: number, uuid: string) {
		super();

		this.uuid = uuid;
		this.port = port;

		this.instance = new Currents(NodeAdapter.fromOptions({
			forceHTTPVersion: 1,
			certificates: this.fetchCertificates()
		}));

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
		];

		this.wsServer = new WebSocketServer({ noServer: true });

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

		this.instance.get('/:nodeId/files/:fileName', this.baseChain.concat([
			verify.bind(this),
			getFile.bind(this)
		]));

		// user actions

		this.instance.post("/api/verify", this.baseChain.concat([
			verify.bind(this),
			async (ctx: Context) => {
				ctx.status(200).json({ error: false, userInfo: ctx.locals.userInfo });
			}
		]));

		this.instance.post("/api/login", this.baseChain.concat([
			JsonBody(),
			login.bind(this)
		]));

		this.instance.post("/api/logout", this.baseChain.concat([
			logout.bind(this)
		]));

		this.instance.post("/api/getUsers", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			getUsers.bind(this)
		]));

		this.instance.post("/api/setPassword", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			setPassword.bind(this)
		]));

		this.instance.post("/api/addUser", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			addUser.bind(this)
		]));

		this.instance.post("/api/deleteUser", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			deleteUser.bind(this)
		]));

		this.instance.post("/api/editUser", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			editUser.bind(this)
		]));

		this.instance.post("/api/createInvite", this.baseChain.concat([
			verify.bind(this),
			createInvite.bind(this)
		]));

		this.instance.post("/api/acceptInvite", this.baseChain.concat([
			JsonBody(),
			acceptInvite.bind(this)
		]));

		this.instance.get("/api/displayName", this.baseChain.concat([
			verify.bind(this),
			getDisplayName.bind(this)
		]));

		this.instance.post("/api/displayName", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			setDisplayName.bind(this)
		]));

		// topic actions

		this.instance.get("/api/myTopics", this.baseChain.concat([
			verify.bind(this),
			myTopics.bind(this)
		]));

		this.instance.get("/api/:nodeId/allTopics", this.baseChain.concat([
			verify.bind(this),
			allTopics.bind(this)
		]));

		this.instance.post("/api/createTopic", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			createTopic.bind(this)
		]));

		this.instance.post("/api/updateTopic", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			updateTopic.bind(this)
		]));

		this.instance.post("/api/deleteTopic", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			deleteTopic.bind(this)
		]));

		this.instance.post("/api/uploadFiles", this.baseChain.concat([
			verify.bind(this),
			StreamingMultipartBody(MP_OPTS),
			uploadFiles.bind(this)
		]));

		// node actions

		this.instance.post("/api/titlePage", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			fetchTitlePage.bind(this)
		]));

		this.instance.get("/api/nodeSettings", this.baseChain.concat([
			verify.bind(this),
			getNodeSettings.bind(this)
		]));

		this.instance.post("/api/nodeSettings", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			setNodeSettings.bind(this)
		]));

		this.instance.get("/api/vapid", this.baseChain.concat([
			verify.bind(this),
			fetchVapid.bind(this)
		]));

		this.instance.post("/api/nodeTitle", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			fetchNodeTitle.bind(this)
		]));

		this.instance.get("/locales", this.baseChain.concat([
			fetchLocales.bind(this)
		]));

		// ws setup

		this.instance.post("/api/requestWS", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			this.requestWS.bind(this)
		]));

		// related

		this.instance.post("/api/handshake", this.baseChain.concat([
			JsonBody(),
			nodeHandshake.bind(this)
		]));

		this.instance.get("/api/:nodeId/related", this.baseChain.concat([
			verify.bind(this),
			fetchRelated.bind(this)
		]));

		this.instance.get("/api/handshakes", this.baseChain.concat([
			verify.bind(this),
			fetchHandshakes.bind(this)
		]));

		this.instance.post("/api/acceptHandshake", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			acceptHandshake.bind(this)
		]));

		this.instance.post("/api/rejectHandshake", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			rejectHandshake.bind(this)
		]));

		this.instance.post("/api/sendHandshake", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			sendHandshake.bind(this)
		]));

		this.instance.post("/api/forgetRelated", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			forgetRelated.bind(this)
		]));

		this.instance.post("/api/goTo", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			goTo.bind(this)
		]));

		// push subscriptions

		this.instance.post("/api/addPush", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			addPushSubscription.bind(this)
		]));

		this.instance.post("/api/deletePush", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			deletePushSubscription.bind(this)
		]));

		// actor actions

		this.instance.post("/api/getActors", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			getActors.bind(this)
		]));

		this.instance.post("/api/getActorInfo", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			getActorInfo.bind(this)
		]));

		this.instance.post("/api/banActor", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			banActor.bind(this)
		]));

		this.instance.post("/api/unbanActor", this.baseChain.concat([
			verify.bind(this),
			JsonBody(),
			unbanActor.bind(this)
		]));

		// PWA

		this.instance.get("/manifest.json", this.baseChain.concat([
			this.returnManifest.bind(this)
		]));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		(this.instance.adapter as NodeAdapter).server.on("upgrade", this.handleUpgrade.bind(this));
		(this.instance.adapter as NodeAdapter).server.on("connection", this.rememberSocket.bind(this));

		(this.instance.adapter as NodeAdapter).server.listen(this.port, () => {
			Log.success("Node listening on " + this.port, 0);
		});
	}

	detach () {
		for (const socket of this.sockets) {
			socket.destroy();
		}

		for (const id in this.wsConnections) {
			clearTimeout(this.wsConnections[id].timeout);
		}

		for (const client of this.wsServer.clients) {
			client.terminate();
		}

		this.wsServer.close();
		(this.instance.adapter as NodeAdapter).server.close();

		super.detach();
	}

	fetchCertificates (): { key: string; cert: string; ca?: string; } | undefined {
		if (FS.existsSync("./data/certificates")) {
			return {
				cert: "./data/certificates/server.cert",
				key: "./data/certificates/server.key",
				ca: FS.existsSync("./data/certificates/server.ca") ? "./data/certificates/server.ca" : undefined
			}
		}

		return undefined;
	}

	get ws_server (): WebSocketServer {
		return this.wsServer;
	}

	rememberSocket (socket: Socket) {
		this.sockets.add(socket);

		socket.on("close", () => {
			this.sockets.delete(socket);
		});
	}

	requestWS (ctx: Context): Promise<void> {
		return new Promise((resolve, reject) => {
			const user_id = ctx.locals.userInfo.id;
			const topic_id = ctx.body.topic_id;
			const topic_node = ctx.body.topic_node;

			const reqId = crypto.randomUUID() as string;

			this.wsConnections[reqId] = {
				is_admin: ctx.locals.userInfo.is_admin,
				is_bot: ctx.locals.userInfo.is_bot,
				user_id: user_id,
				topic_id: topic_id,
				topic_node: topic_node,
				timeout: setTimeout(() => {
					delete this.wsConnections[reqId];
				}, 1000 * 60 * 5)
			}

			ctx.status(200).json({ error: false, data: reqId });
		});
	}

	handleUpgrade (request: any, socket: any, head: any) {
		const { pathname } = parse(request.url || '');

		if (!pathname || !pathname.startsWith("/ws")) {
			socket.destroy();
			return;
		}

		const reqId = pathname.split("/")[2];

		if (!this.wsConnections[reqId]) {
			socket.destroy();
			return;
		}

		clearTimeout(this.wsConnections[reqId].timeout);

		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "findActor",
			data: {
				node_id: null,
				node_user_id: this.wsConnections[reqId].user_id
			}
		}, (dbResponse) => {
			if (dbResponse.data.error) {
				socket.destroy();
			} else {
				let nodeId = this.wsConnections[reqId].topic_node;
				let topicId = this.wsConnections[reqId].topic_id;

				if (!nodeId || !topicId) {
					socket.destroy();
					return;
				}

				if (this.wsConnections[reqId].topic_node === "self") {
					this.wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => {
						const managerAddr = this.address!.parent.data;
						managerAddr.push("topics");

						this.send(managerAddr, {
							command: "wsConnection",
							data: {
								socket: ws,
								topic_id: this.wsConnections[reqId].topic_id,
								is_admin: this.wsConnections[reqId].is_admin,
								is_bot: this.wsConnections[reqId].is_bot,
								id: dbResponse.data.data.id,
								node_user_id: this.wsConnections[reqId].user_id,
								display_name: dbResponse.data.data.display_name,
								is_banned: dbResponse.data.data.is_banned
							}
						});
						delete this.wsConnections[reqId];
					});
				} else {
					// proxy to gate
					this.wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => {
						const gateAddr = this.address!.parent.data;
						gateAddr.push("gate");
						
						this.send(gateAddr, {
							command: "wsConnection",
							data: {
								socket: ws,
								topic_node: this.wsConnections[reqId].topic_node,
								topic_id: this.wsConnections[reqId].topic_id,
								node_user_id: this.wsConnections[reqId].user_id,
								display_name: dbResponse.data.data.display_name
							}
						});
						delete this.wsConnections[reqId];
					});
				}
			}
		});
	}

	async returnManifest (ctx: Context) {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		const infoEvent = await this.chainAsync(dbAddress, {
			command: "getNodeSettings",
			data: {}
		});

		ctx.status(200).json({
			"id": `HEARTHCHAT_${infoEvent.data.data.uuid}`,
			"name": `HearthChat - ${infoEvent.data.data.title}`,
			"short_name": `${infoEvent.data.data.title}`,
			"start_url": "/",
			"display": "standalone",
			"background_color": "#000000",
			"theme_color": "#000000",
			"icons": [
				{
				  "src": "./icon.png",
				  "sizes": "192x192",
				  "type": "image/png"
				}
			]
		});
	}
}