import EventEmitter from "events"
import { WebSocket } from "ws"

export default class ActorProxy extends EventEmitter {
	private socket: WebSocket;
	private local_id: number;
	private topic_id: number;
	private display_name: string;
	private node_user_id: number;

	constructor (socket: WebSocket, topic_id: number, display_name: string, node_user_id: number) {
		super();

		this.socket = socket;
		this.topic_id = topic_id;
		this.display_name = display_name;
		this.node_user_id = node_user_id;
	}

	setLocalId (id: number) {
		this.local_id = id;
	}

	kickstart () {
		this.emit("event", {
			command: "createProxy",
			data: {
				node_user_id: this.node_user_id,
				display_name: this.display_name,
				topic_id: this.topic_id
			}
		});
	}

	kill () {
		this.socket.destroy();
	}

	forward () {
		
	}
}