import { WebSocket } from "ws"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

import WSActor from "./wsActor.js"
import TopicInterface from "./topicInterface.js"

export default class TopicManager extends Node {
	private topics: Record<number, TopicInterface> = {};
	private pendingIds: Record<number, Promise<void>> = {};

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("wsConnection", this.handleWSConnection.bind(this));
		this.setListener("proxyConnection", this.handleProxyConnection.bind(this));
	}

	async handleWSConnection (event: Event) {
		const socket: WebSocket = event.data.data.socket;
		const display_name: string = event.data.data.display_name;
		const node_id: string = event.data.data.node_id;
		const node_user_id: number = event.data.data.node_user_id;
		const topic_id: number = event.data.data.topic_id;

		try {
			if (!this.topics[topic_id]) {
				if (!this.pendingIds[topic_id]) {
					const pr = this.fetchTopic(topic_id);
					this.pendingIds[topic_id] = pr;	
				}

				await this.pendingIds[topic_id];
			}

			const actor = new WSActor(display_name, node_id, node_user_id, socket);
			this.topics[topic_id]!.connectActor(actor);
		} catch (err: any) {
			socket.terminate();
		}
	}

	handleProxyConnection (event: Event) {

	}

	fetchTopic (topic_id: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const dbAddr = this.address!.parent.data;
			dbAddr.push("db");

			this.chain(dbAddr, {
				command: "getTopicById",
				data: { id: topic_id }
			}, (response: Event) => {
				delete this.pendingIds[topic_id];

				if (response.data.error) {
					Log.error(`Can't fetch topic ${topic_id}: ${response.data.details}`, 0);
					reject(`Can't fetch topic ${topic_id}: ${response.data.details}`);
				} else {
					this.topics[topic_id] = new TopicInterface(
						response.data.data.title,
						response.data.data.description,
						response.data.data.guest_access,
						response.data.data.password_protected,
						response.data.data.author_write_only,
						response.data.data.author_id
					);
					resolve();
				}
			})
		});
	}
}