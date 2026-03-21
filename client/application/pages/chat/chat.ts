import { Component, TemplateCache } from "@tripod311/splash"
import View from "./chat.html?raw"

import Model from "../../../model/main.js"

import PhoneIcon from "../../../icons/phone-call.svg"
import SendIcon from "../../../icons/send.svg"
import FileIcon from "../../../icons/file.svg"

import SystemMessage from "./messages/systemMessage.html?raw"
TemplateCache.registerDrop("chatSystemMessage", SystemMessage);

export default class ChatPage extends Component {
	protected static componentName = "Chat";
	protected static template = View;

	private socket!: WebSocket;
	private enterListener!: (e: KeyEvent) => void;

	mounted () {
		super.mounted();

		this.enterListener = this.enterListener.bind(this);

		this.refs.send.src = SendIcon;
		this.refs.voice.src = PhoneIcon;
		this.refs.attach.src = FileIcon;

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
		const topic_id = sp[3];

		const response = await Model.getPipe("api.topic.wsRequest").run({ topic_id, topic_node });

		if (response.error) {
			spinner.emit("close");
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.socket = new WebSocket(`/${ws}/${response.data}`);

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

	myMessage () {

	}

	fileMessage () {

	}

	otherMessage () {

	}

	handleMessage (e: MessageEvent) {
		const data = JSON.parse(e.data) as { command: string; data: any; };

		switch (data.command) {
			case "ping":
				this.socket.send(JSON.stringify({ command: "pong" }));
				break;
			case "setup":
				break;
			case "actorConnected":
				break;
			case "actorDisconnected":
				break;
			case "newMessage":
				break;
		}
	}

	socketDown (err: any) {
		this.systemMessage(`Connection closed: ${err.message || err.toString()}`);
	}

	enterListener (e: KeyEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();

			this.send();
		}
	}

	send () {
		const text = this.ref.input.value.trim();

		if (text.length > 0) {
			this.socket!.send(JSON.stringify({ command: "pushMessage", data: text}));
			this.ref.input.value = "";
			this.myMessage(text);
		}
	}
}