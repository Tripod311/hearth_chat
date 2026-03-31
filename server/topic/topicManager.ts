import { WebSocket } from "ws"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

import WSActor from "./wsActor.js"
import ProxyActor from "./proxyActor.js"
import TopicInterface from "./topicInterface.js"

export default class TopicManager extends Node {
	private topics: Record<number, TopicInterface> = {};
	private pendingIds: Record<number, Promise<void>> = {};

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("wsConnection", this.handleWSConnection.bind(this));
		this.setListener("proxyConnection", this.handleProxyConnection.bind(this));

		this.setListener("topicDeleted", this.onTopicDeleted.bind(this));
	}

	async handleWSConnection (event: Event) {
		const socket: WebSocket = event.data.data.socket;
		const display_name: string = event.data.data.display_name;
		const is_admin: boolean = event.data.data.is_admin;
		const is_bot: boolean = event.data.data.is_bot;
		const id: number = event.data.data.id;
		const node_user_id = event.data.data.node_user_id;
		const topic_id: number = event.data.data.topic_id;

		try {
			if (!this.topics[topic_id]) {
				if (!this.pendingIds[topic_id]) {
					this.pendingIds[topic_id] = this.fetchTopic(topic_id);
				}

				await this.pendingIds[topic_id];

				if (!this.pendingIds[topic_id] && !this.topics[topic_id]) {
					throw new Error(`Topic ${topic_id} was deleted`);
				}
				
				delete this.pendingIds[topic_id];
			}

			const actor = new WSActor(is_admin, is_bot, display_name, id, node_user_id, socket);
			this.topics[topic_id]!.connectActor(actor);
		} catch (err: any) {
			delete this.pendingIds[topic_id];
			socket.terminate();
		}
	}

	async handleProxyConnection (event: Event) {
		const proxy = event.data.data.proxy;
		const actor_id = event.data.data.actor_id;
		const topic_id = event.data.data.topic_id;
		const node_id = event.data.data.node_id;

		try {
			if (!this.topics[topic_id]) {
				if (!this.pendingIds[topic_id]) {
					this.pendingIds[topic_id] = this.fetchTopic(topic_id);
				}

				await this.pendingIds[topic_id];

				if (!this.pendingIds[topic_id] && !this.topics[topic_id]) {
					throw new Error(`Topic ${topic_id} was deleted`);
				}
				
				delete this.pendingIds[topic_id];
			}

			const actor = new ProxyActor(actor_id, node_id, proxy);
			this.topics[topic_id]!.connectActor(actor);

			event.response({
				command: "proxyConnectionResponse",
				error: false
			});
		} catch (err: any) {
			event.response({
				command: "proxyConnectionResponse",
				error: true,
				details: err.toString()
			});
		}
	}

	fetchTopic (topic_id: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const dbAddr = this.address!.parent.data;
			dbAddr.push("db");

			this.chain(dbAddr, {
				command: "getTopicById",
				data: { id: topic_id }
			}, (response: Event) => {
				if (response.data.error) {
					Log.error(`Can't fetch topic ${topic_id}: ${response.data.details}`, 0);
					reject(`Can't fetch topic ${topic_id}: ${response.data.details}`);
				} else {
					this.topics[topic_id] = new TopicInterface(
						topic_id,
						response.data.data.title,
						response.data.data.description,
						response.data.data.guest_access,
						response.data.data.password_protected,
						response.data.data.author_write_only,
						response.data.data.author_id
					);
					this.addChild(topic_id.toString(), this.topics[topic_id]);
					this.topics[topic_id].createRouter().then(() => {
						resolve();
					});
				}
			})
		});
	}

	onTopicDeleted (event: Event) {
		const id = event.data.data.id.toString();

		delete this.pendingIds[id];

		if (this.topics[id]) {
			this.delChild(id);
		}
	}
}