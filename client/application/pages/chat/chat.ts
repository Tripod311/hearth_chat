import { Component, TemplateCache } from "@tripod311/splash"
import View from "./chat.html?raw"

import Model from "../../../model/main.js"

import PhoneIcon from "../../../icons/phone-call.svg"
import SendIcon from "../../../icons/send.svg"
import FileIcon from "../../../icons/file.svg"
import DeleteIcon from "../../../icons/delete.svg"

import ChatMessage from "./messages/chatMessage.js"
import SystemMessage from "./messages/systemMessage.html?raw"
import SpinnerMessage from "./messages/spinnerMessage.html?raw"
import Attachment from "./attachment.html?raw"

TemplateCache.registerDrop("chatSystemMessage", SystemMessage);
TemplateCache.registerDrop("chatSpinnerMessage", SpinnerMessage);
TemplateCache.registerDrop("attachment", Attachment);

import VoiceChat from "./voiceChat/voiceChat.js"
import VoiceControls from "./voiceControls.js"

interface TopicInfo {
	selfId: number;
	selfName: string;
	title: string;
	description: string;
	password_protected: boolean;
	authorized: boolean;
	can_write: boolean;
	rtpCapabilities: any;
	iceServers: any;
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
	attachments: string[];
	created_at: number;
}

interface ChunkData {
	messages: Message[];
	requestedOffset: number;
	replaceContent: boolean;
}

interface ChunkErrorData {
	requestedOffset: number;
	requestedDirection: string;
	replaceContent: boolean;
}

export default class ChatPage extends Component {
	protected static componentName = "Chat";
	protected static template = View;

	private static readonly CHUNK_SIZE = 50;
	private static readonly LIMIT = 200;

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
	private atTop: boolean = false;
	private atBottom: boolean = true;
	private pendingBottomMessages: Message[] = [];

	private voiceOpen: boolean = false;
	private voiceChat!: VoiceChat;
	private voiceControls!: VoiceControls;

	mounted () {
		super.mounted();

		this.enterListener = this.handleEnter.bind(this);

		this.refs.send.src = SendIcon;
		this.refs.send.onclick = this.send.bind(this);
		this.refs.voice.src = PhoneIcon;
		this.refs.voice.onclick = this.toggleVoiceChat.bind(this);
		this.refs.attach.src = FileIcon;
		this.refs.attach.onclick = this.addFile.bind(this);
		this.refs.fileInput.onchange = this.handleFileInput.bind(this);
		this.refs.messages.onscroll = this.handleScroll.bind(this);

		this.voiceControls = new VoiceControls();
		this.voiceControls.onmessage = this.voiceControlsMessage.bind(this);
		this.voiceChat = new VoiceChat({
			controls: this.voiceControls
		});
		this.voiceChat.on("toggle", this.toggleVoiceChat.bind(this));
		this.slots.voiceChat.push(this.voiceChat);

		this.makeConnection();
	}

	unmounted () {
		this.refs.input.removeEventListener("keyup", this.enterListener);
		this.socket.close();
		this.voiceControls.deleteTransport();

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
			this.socket.onerror = (err: any) => {
				console.error(err);
				spinner.emit("close");
				this.systemMessage("Connection error");
			};
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

	onNewMessage (message: Message) {
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

		while (this.slots.messages.length > ChatPage.LIMIT) {
			this.slots.messages.unshift();
			this.atStart = false;
		}

		this.refs.messages.scrollTop = this.refs.messages.scrollHeight;
	}

	handleMessage (e: MessageEvent) {
		console.log(e.data);
		const data = JSON.parse(e.data) as { command: string; data: any; };

		switch (data.command) {
			case "ping":
				this.socket.send(JSON.stringify({ command: "pong" }));
				break;
			case "setup":
				this.setup(data.data).then(() => {
					if (this.topicInfo.authorized) {
						this.fetchMessages(-1, true);
					}
				}, (err: any) => {
					const notification = Model.getPipe("modals.createNotification").run({
						message: `Error on setup: ${err.message || err.toString()}`,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				});
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
			case "message":
				if (this.atEnd && this.atBottom) {
					this.onNewMessage(data.data);
				} else if (this.waitingBottomChunk) {
					this.pendingBottomMessages.push(...data.messages);
				}
				break;
			case "transportCreated":
				this.voiceControls.transportCreated(data.data);
				break;
			case "transportConnected":
				this.voiceControls.transportConnected(data.data);
				break;
			case "producerCreated":
				this.voiceControls.producerCreated(data.data);
				break;
			case "consumerCreated":
				this.voiceControls.consumerCreated(data.data);
				break;
			case "consumerResumed":
				this.voiceControls.consumerResumed(data.data);
				break;
			case "mediaUpdate":
				this.voiceControls.mediaUpdate(data.data)
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

	async setup (data: TopicInfo) {
		this.topicInfo = data.topicInfo;
		this.connectedActors = data.actors;

		this.refs.title.innerText = this.topicInfo.title;

		if (this.topicInfo.password_protected && !this.topicInfo.authorized) {
			this.systemMessage("This topic is password protected. Send correct password to read it.");
		}

		await this.voiceControls.createDevice();
		await this.voiceControls.load(data.rtpCapabilities);
		this.voiceControls.iceServers = data.iceServers;
		this.voiceControls.selfId = this.topicInfo.selfId;
		this.voiceControls.mediaUpdate(data.mediaState);
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

	fetchMessages (offset: number, direction: '<' | '>' = '<', replaceContent: boolean = false) {
		this.socket.send(JSON.stringify({
			command: "fetchMessages",
			data: {
				offset: offset,
				direction: direction,
				replaceContent: replaceContent,
				chunk_size: ChatPage.CHUNK_SIZE
			}
		}));
	}

	firstInView (): HTMLElement | null {
		if (this.slots.messages.length > 0) {
			return this.slots.messages.getByIndex(0).DOMNode;
		}

		return null;
	}

	lastInView (): HTMLElement | null {
		let result: HTMLElement | null = null;

		if (this.slots.messages.length > 0) {
			const rect = this.refs.messages.getBoundingClientRect();

			let index = 0;
			while (true) {
				if (index === this.refs.messages.length) break;

				const msg = this.slots.messages.getByIndex(index).DOMNode;
				const msgRect = msg.getBoundingClientRect();

				if (msgRect.top <= rect.top + rect.height) {
					result = msg;
				} else {
					break;
				}

				index++;
			}
		}

		return result;
	}

	replaceMessages (data: ChunkData) {
		this.slots.messages.clear();

		if (data.messages.length === 0) {
			this.topMessageId = 0;
			this.bottomMessageId = 0;
			this.atStart = true;
			this.atEnd = true;
			this.atBottom = true;
		} else {
			for (const message of data.messages) {
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

			if (data.messages.length < ChatPage.CHUNK_SIZE) {
				this.atStart = true;
				this.atEnd = true;
				this.atBottom = true;
			} else if (data.requestedOffset === -1) {
				this.atStart = false;
				this.atEnd = true;
				this.atBottom = true;
			}

			this.recalculateTopBottom();
		}

		this.refs.messages.scrollTop = this.refs.messages.scrollHeight;
	}

	addTopMessages (data: ChunkData) {
		this.slots.messages.shift();

		const scrollTo = this.lastInView();

		for (let index=data.messages.length-1; index>=0; index--) {
			const message = data.messages[index];

			if (message.actor_id === this.topicInfo.selfId) {
				const comp = new ChatMessage({
					...message,
					is_mine: true
				});

				this.slots.messages.unshift(comp);
			} else {
				const comp = new ChatMessage({
					...message,
					is_mine: false
				});

				this.slots.messages.unshift(comp);
			}
		}

		if (data.messages.length < ChatPage.CHUNK_SIZE) {
			this.atStart = true;
		}

		while (this.slots.messages.length > ChatPage.LIMIT) {
			this.slots.messages.pop();
			this.atEnd = false;
			this.atBottom = false;
		}

		this.waitingTopChunk = false;
		
		if (scrollTo) {
			scrollTo.scrollIntoView({ block: 'end' });
		}

		this.recalculateTopBottom();
	}

	addBottomMessages (data: ChunkData) {
		this.slots.messages.pop();

		const scrollTo = this.firstInView();

		for (const message of data.messages) {
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

		if (data.messages.length < ChatPage.CHUNK_SIZE) {
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
		}

		this.pendingBottomMessages.length = 0;

		while (this.slots.messages.length > ChatPage.LIMIT) {
			this.slots.messages.shift();
			this.atStart = false;
		}

		this.waitingBottomChunk = false;

		if (scrollTo) {
			scrollTo.scrollIntoView({ block: 'end' });
		}

		this.recalculateTopBottom();
	}

	recalculateTopBottom () {
		this.topMessageId = this.slots.messages.getByIndex(0).id;
		this.bottomMessageId = this.slots.messages.getByIndex(this.slots.messages.length - 1).id;
	}

	onChunkResponse (data: ChunkData) {
		if (data.requestedOffset === -1) {
			// initial
			this.replaceMessages(data);
		} else if (data.replaceContent) {
			// scroll to pinned message. Not implemented yet
		} else {
			if (data.requestedDirection === '<') {
				this.addTopMessages(data);
			} else if (data.requestedDirection === '>') {
				this.addBottomMessages(data);
			}
		}

		console.log(`TOP: ${this.topMessageId} BOTTOM: ${this.bottomMessageId}`);
	}

	onChunkError (data: ChunkErrorData) {
		if (data.requestedOffset === this.topMessageId) {
			this.slots.messages.shift();
		} else if (data.requestedOffset <= this.bottomMessageId) {
			this.slots.messages.pop();
		}
	}

	fetchTop () {
		if (this.socket.readyState === WebSocket.OPEN && !this.waitingTopChunk && !this.atStart) {
			const spinner = Component.generic({}, TemplateCache.createDrop("chatSpinnerMessage", {}).node);
			this.slots.messages.unshift(spinner);

			this.fetchMessages(Math.max(0, this.topMessageId), '<');
			this.waitingTopChunk = true;
		}
	}

	fetchBottom () {
		if (this.socket.readyState === WebSocket.OPEN && !this.waitingBottomChunk && !this.atEnd) {
			const spinner = Component.generic({}, TemplateCache.createDrop("chatSpinnerMessage", {}).node);
			this.slots.messages.push(spinner);

			this.fetchMessages(this.bottomMessageId, '>');
			this.waitingBottomChunk = true;
		}
	}

	async send () {
		const text = this.refs.input.value.trim();

		if (text.length > 0 || this.filesToSend.length > 0) {
			let attachments: string[] = [];

			if (this.topicInfo.authorized && this.filesToSend.length > 0) {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.topic.uploadFiles").run(this.filesToSend);
				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);

					return;
				} else {
					attachments = response.data.data;
				}
			}

			this.socket!.send(JSON.stringify({
				command: "pushMessage",
				data: {
					content: text,
					attachments: attachments
				}
			}));
			this.refs.input.value = "";
			this.filesToSend = [];
			this.renderFiles();
		}
	}

	handleScroll () {
		this.atTop = false;
		this.atBottom = false;

		const reachedEnd = this.refs.messages.scrollTop + this.refs.messages.clientHeight >= this.refs.messages.scrollHeight;
		const reachedStart = this.refs.messages.scrollTop === 0;

		if (reachedStart) {
			this.atTop = true;

			this.fetchTop();
		} else if (reachedEnd) {
			if (!this.atEnd) {
				this.fetchBottom();
			} else {
				this.atBottom = true;
			}
		}
	}

	addFile () {
		this.refs.fileInput.click();
	}

	handleFileInput () {
		const file = this.refs.fileInput.files[0];

		if (!!file) {
			this.filesToSend.push(file);
			this.renderFiles();
		}
	}

	renderFiles () {
		this.refs.attachments.innerHTML = "";

		if (this.filesToSend.length === 0) {
			this.refs.attachments.style.display = "none";
		} else {
			this.refs.attachments.style.display = "flex";

			for (let i=0; i<this.filesToSend.length; i++) {
				const file = this.filesToSend[i];
				const drop = TemplateCache.createDrop("attachment", {
					name: file.name
				});
				drop.refs.delete.src = DeleteIcon;
				drop.refs.delete.onclick = this.rmAttachment.bind(this, i);
				this.refs.attachments.appendChild(drop.node);
			}
		}
	}

	rmAttachment (index: number) {
		this.filesToSend.splice(index, 1);

		this.renderFiles();
	}

	toggleVoiceChat () {
		this.voiceOpen = !this.voiceOpen;

		if (this.voiceOpen) {
			this.voiceChat.open();
		} else {
			this.voiceChat.close();
		}
	}

	voiceControlsMessage (msg: { command: string; data: any; }) {
		if (this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(msg));
		}
	}
}