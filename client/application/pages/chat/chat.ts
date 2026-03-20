import { Component } from "@tripod311/splash"
import View from "./chat.html?raw"

import PhoneIcon from "../../../icons/phone-call.svg"
import SendIcon from "../../../icons/send.svg"

export default class ChatPage extends Component {
	protected static componentName = "Chat";
	protected static template = View;

	private socket!: WebSocket;

	mounted () {
		super.mounted();

		this.refs.send.src = SendIcon;
		this.refs.voice.src = PhoneIcon;

		this.makeConnection();
	}

	makeConnection () {

	}
}