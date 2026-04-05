import { Component } from "@tripod311/splash"
import View from "./chatMessage.html?raw"

import MessageAttachment from "./messageAttachment.js"

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

		const date = new Date(this.state.getProp("created_at") * 1000);
		this.state.setProp("datetime", ChatMessage.timeFormat.format(date) + " " + ChatMessage.dateFormat.format(date));

		if (this.state.getProp("is_guest")) {
			this.refs.is_guest.style.display = "block";
		}

		this.refs.header.onclick = this.emit.bind(this, "showActorInfo", this.state.getProp("actor_id"));

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

			for (const link of attachments) {
				this.slots.attachments.push(new MessageAttachment({ link }));
			}
		}
	}

	get id(): number {
		return this.state.getProp("id") as number;
	}
}