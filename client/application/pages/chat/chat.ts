import { Component, TemplateCache } from "@tripod311/splash"
import View from "./chat.html?raw"

import Model from "../../../model/main.js"

import PhoneIcon from "../../../icons/phone-call.svg"
import SendIcon from "../../../icons/send.svg"
import FileIcon from "../../../icons/file.svg"

import ChatMessage from "./messages/chatMessage.js"
import SystemMessage from "./messages/systemMessage.html?raw"
import SpinnerMessage from "./messages/spinnerMessage.html?raw"

TemplateCache.registerDrop("chatSystemMessage", SystemMessage);
TemplateCache.registerDrop("chatSpinnerMessage", SpinnerMessage);

interface TopicInfo {
	selfId: number;
	selfName: string;
	title: string;
	description: string;
	password_protected: boolean;
	authorized: boolean;
	can_write: boolean;
}

interface ActorInfo {
	is_bot: boolean;
	is_admin: boolean;
	id: number;
	display_name: string;
}

interface Message {
	id: number;
	actor_id: number;
	display_name: string;
	content: string;
	attachments: string;
	created_at: number;
}

interface ChunkData {
	messages: Message[];
	requestedOffset: number;
	replaceContent: boolean;
}

interface ChunkErrorData {
	requestedOffset: number;
	replaceContent: boolean;
}

export default class ChatPage extends Component {
	protected static componentName = "Chat";
	protected static template = View;

	private static readonly CHUNK_SIZE = 100;
	private static readonly LIMIT = 400;

	private socket!: WebSocket;
	private enterListener!: (e: KeyEvent) => void;
	private topicInfo!: TopicInfo;
	private connectedActors!: ActorInfo[];
	private filesToSend: File[] = [];

	private waitingTopChunk: boolean = false;
	private waitingBottomChunk: boolean = false;
	private topMessageId: number = 0;
	private bottomMessageId: number = 0;
	private atStart: boolean = false;
	private atEnd: boolean = false;
	private atBottom: boolean = true;
	private pendingBottomMessages: Message[] = [];

	mounted () {
		super.mounted();

		this.enterListener = this.handleEnter.bind(this);

		this.refs.send.src = SendIcon;
		this.refs.send.onclick = this.send.bind(this);
		this.refs.voice.src = PhoneIcon;
		this.refs.attach.src = FileIcon;
		this.refs.messages.onscroll = this.handleScroll.bind(this);

		this.makeConnection();
	}

	unmounted () {
		this.refs.input.removeEventListener("keyup", this.enterListener);

		super.unmounted();
	}

	async makeConnection () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const sp = window.location.pathname.split("/");
		const topic_node = sp[1];
		const topic_id = parseInt(sp[3]);

		const response = await Model.getPipe("api.topic.wsRequest").run({ topic_id, topic_node });

		if (response.error) {
			spinner.emit("close");
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.socket = new WebSocket(`/ws/${response.data}`);

			this.socket.onopen = () => {
				spinner.emit("close");
				this.bindSocketEvents();
			};
			this.socket.onerror = () => {
				spinner.emit("close");
				this.systemMessage("Connection error");
			}
		}
	}

	bindSocketEvents () {
		this.refs.input.addEventListener("keyup", this.enterListener);

		this.socket.onmessage = this.handleMessage.bind(this);
		this.socket.onclose = this.socketDown.bind(this);
		this.socket.onerror = this.socketDown.bind(this);
	}

	systemMessage (text: string) {
		const drop = TemplateCache.createDrop("chatSystemMessage", { message: text });
		const comp = Component.generic({}, drop.node);

		this.slots.messages.push(comp);
	}

	handleMessage (e: MessageEvent) {
		const data = JSON.parse(e.data) as { command: string; data: any; };

		switch (data.command) {
			case "ping":
				this.socket.send(JSON.stringify({ command: "pong" }));
				break;
			case "setup":
				this.setup(data.data);
				if (this.topicInfo.authorized) {
					this.waitingBottomChunk = true;
					this.fetchMessages(-1, true);
				}
				break;
			case "authorize":
				this.onAuth();
				break;
			case "actorConnected":
				this.onActorConnected(data.data);
				break;
			case "actorDisconnected":
				this.onActorDisconnected(data.data);
				break;
			case "chunkResponse":
				this.onChunkResponse(data.data);
				break;
			case "chunkError":
				this.onChunkError(data.data);
				break;
			case "newMessage":
				if (this.atBottom) {
					this.onNewMessage(data.data);
				} else if (this.waitingBottomChunk) {
					this.pendingBottomMessages.push(...data.messages);
				}
				break;
		}
	}

	socketDown (err: any) {
		this.systemMessage(`Connection closed`);
	}

	handleEnter (e: KeyEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();

			this.send();
		}
	}

	setup (data: TopicInfo) {
		this.topicInfo = data.topicInfo;
		this.connectedActors = data.actors;

		this.refs.title.innerText = this.topicInfo.title;

		if (this.topicInfo.password_protected && !this.topicInfo.authorized) {
			this.systemMessage("This topic is password protected. Send correct password to read it.");
		}
	}

	onActorConnected (data: ActorInfo) {
		this.connectedActors.push(data);
	}

	onActorDisconnected (data: ActorInfo) {
		this.connectedActors = this.connectedActors.filter(a => a.id !== data.id);
	}

	onAuth () {
		this.topicInfo.authorized = true;

		this.waitingBottomChunk = true;
		this.fetchMessages(-1, true);
	}

	fetchMessages (offset: number, replaceContent: boolean = false) {
		this.socket.send(JSON.stringify({
			command: "fetchMessages",
			data: {
				offset: offset,
				replaceContent: replaceContent,
				chunk_size: Chat.CHUNK_SIZE
			}
		}));
	}

	onChunkResponse (data: ChunkData) {
		if (data.requestedOffset === -1) {
			// initial
			this.slots.messages.clear();

			if (data.messages.length === 0) {
				this.topMessageId = 0;
				this.bottomMessageId = 0;
				this.atStart = true;
				this.atEnd = true;
				this.atBottom = true;
			} else {
				this.topMessageId = Infinity;
				this.bottomMessageId = -Infinity;

				for (const message of data.messages) {
					this.topMessageId = Math.min(this.topMessageId, message.id);
					this.bottomMessageId = Math.max(this.bottomMessageId, message.id);

					if (message.actor_id === this.topicInfo.selfId) {
						const comp = new ChatMessage({
							...message,
							is_mine: true
						});

						this.slots.messages.push(comp);
					} else {
						const comp = new ChatMessage({
							...message,
							is_mine: false
						});

						this.slots.messages.push(comp);
					}
				}

				if (data.messages.length < Chat.CHUNK_SIZE) {
					this.atStart = true;
					this.atEnd = true;
				}
			}
		} else if (data.replaceContent) {
			// scroll to pinned message. Not implemented yet
		} else {
			if (data.requestedOffset === this.topMessageId) {
				this.slots.messages.unshift();

				for (const message of data.messages) {
					this.topMessageId = Math.min(this.topMessageId, message.id);
					this.bottomMessageId = Math.max(this.bottomMessageId, message.id);

					if (message.actor_id === this.topicInfo.selfId) {
						const comp = new ChatMessage({
							...message,
							is_mine: true
						});

						this.slots.messages.push(comp);
					} else {
						const comp = new ChatMessage({
							...message,
							is_mine: false
						});

						this.slots.messages.push(comp);
					}
				}

				if (data.messages.length < Chat.CHUNK_SIZE) {
					this.atStart = true;
				}

				while (this.slots.messages.length > Chat.LIMIT) {
					this.slots.messages.pop();
					this.atEnd = false;
					this.atBottom = false;
				}

				this.waitingTopChunk = false;
			} else if (data.requestedOffset <= this.bottomMessageId) {
				this.slots.messages.pop();

				for (const message of data.messages) {
					this.topMessageId = Math.min(this.topMessageId, message.id);
					this.bottomMessageId = Math.max(this.bottomMessageId, message.id);

					if (message.actor_id === this.topicInfo.selfId) {
						const comp = new ChatMessage({
							...message,
							is_mine: true
						});

						this.slots.messages.push(comp);
					} else {
						const comp = new ChatMessage({
							...message,
							is_mine: false
						});

						this.slots.messages.push(comp);
					}
				}

				if (data.messages.length < Chat.CHUNK_SIZE) {
					this.atEnd = true;
					this.atBottom = true;

					for (const message of this.pendingBottomMessages) {
						if (message.actor_id === this.topicInfo.selfId) {
							const comp = new ChatMessage({
								...message,
								is_mine: true
							});

							this.slots.messages.push(comp);
						} else {
							const comp = new ChatMessage({
								...message,
								is_mine: false
							});

							this.slots.messages.push(comp);
						}
					}

					this.pendingBottomMessages.length = 0;
				}

				while (this.slots.messages.length > Chat.LIMIT) {
					this.slots.messages.unshift();
					this.atStart = false;
				}

				this.refs.messages.scrollTop = this.refs.messages.scrollHeight;

				this.waitingBottomChunk = false;
			}
		}
	}

	onChunkError (data: ChunkErrorData) {
		if (data.requestedOffset === this.topMessageId) {
			this.slots.messages.unshift();
		} else if (data.requestedOffset <= this.bottomMessageId) {
			this.slots.messages.pop();
		}
	}

	fetchTop () {
		if (this.socket.readyState === WebSocket.OPEN && !this.waitingTopChunk) {
			const spinner = Component.generic({}, TemplateCache.createDrop("chatSpinnerMessage", {}));
			this.slots.messages.unshift(spinner);

			this.fetchMessages(Math.max(0, this.topMessageId));
			this.waitingTopChunk = true;
		}
	}

	fetchBottom () {
		if (this.socket.readyState === WebSocket.OPEN && !this.waitingBottomChunk) {
			const spinner = Component.generic({}, TemplateCache.createDrop("chatSpinnerMessage", {}));
			this.slots.messages.push(spinner);

			this.fetchMessages(this.bottomMessageId + Chat.CHUNK_SIZE);
			this.waitingBottomChunk = true;
		}
	}

	async send () {
		const text = this.refs.input.value.trim();

		if (text.length > 0 || this.filesToSend.length > 0) {
			let attachments: string[] = [];

			if (this.authorized && this.filesToSend.length > 0) {
				// await upload
			}

			this.socket!.send(JSON.stringify({
				command: "pushMessage",
				data: {
					content: text,
					attachments: attachments
				}
			}));
			this.refs.input.value = "";
			this.refs.attachments.innerHTML = "";
			this.refs.attachments.style.display = "none";
		}
	}

	handleScroll () {
		this.atBottom = false;

		const reachedEnd = this.refs.messages.scrollTop + this.refs.messages.clientHeight >= this.refs.messages.scrollHeight;
		const reachedStart = this.refs.messages.scrollTop === 0;

		if (reachedStart) {
			this.topMessageId -= Chat.CHUNK_SIZE;

			this.fetchTop();
		} else if (reachedEnd) {
			if (!this.atEnd) {
				this.fetchBottom();
			} else {
				this.atBottom = true;
			}
		}
	}
}