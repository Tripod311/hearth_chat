import { Component } from "@tripod311/splash"
import View from "./chatMessage.html?raw"

export default class ChatMessage extends Component {
	protected static readonly timeFormat = new Intl.DateTimeFormat('ru-RU', {
	    hour: '2-digit',
	    minute: '2-digit'
	  });

	protected static readonly dateFormat = new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});

	protected static componentName = "ChatMessage";
	protected static template = View;

	mounted () {
		super.mounted();

		const date = new Date(this.state.getProp("created_at"));
		this.state.setProp("datetime", ChatMessage.timeFormat.format(date) + " " + ChatMessage.dateFormat.format(date));

		if (this.state.getProp("is_mine")) {
			this.refs.container.style["align-self"] = "flex-end";
		} else {
			this.refs.container.style["align-self"] = "flex-start";
		}

		this.fillAttachments();
	}

	fillAttachments () {
		const attachments = this.state.getProp("attachments");

		if (attachments.length === 0) {
			this.refs.attachments.style.display = "none";
		} else {
			// fill
		}
	}
}