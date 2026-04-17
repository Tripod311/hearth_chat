import { Component } from "@tripod311/splash"
import View from "./topicBlock.html?raw"

import Model from "../../../model/main.js"

import LockIcon from "../../../icons/lock.svg"
import HomeIcon from "../../../icons/home.svg"
import EyeIcon from "../../../icons/eye.svg"

export default class TopicBlock extends Component {
	protected static componentName = "TopicDescriptionBlock";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.container.onclick = this.enter.bind(this);

		this.refs.detailsTitle.innerText = Model.getPipe("locale.getLocalized").run("topics.details");

		if (this.state.getProp("password_protected")) {
			const block = document.createElement("div");
			block.className = "flex flex-row items-center gap-2";
			const img = document.createElement("img");
			img.src = LockIcon;
			img.className = "w-[20px] h-[20px]";
			const content = document.createElement("span");
			content.innerText = Model.getPipe("locale.getLocalized").run("topics.password_protected");
			block.appendChild(img);
			block.appendChild(content);
			this.refs.features.appendChild(block);
		}

		if (!this.state.getProp("guest_access")) {
			const block = document.createElement("div");
			block.className = "flex flex-row items-center gap-2";
			const img = document.createElement("img");
			img.src = HomeIcon;
			img.className = "w-[20px] h-[20px]";
			const content = document.createElement("span");
			content.innerText = Model.getPipe("locale.getLocalized").run("topics.guest_access");
			block.appendChild(img);
			block.appendChild(content);
			this.refs.features.appendChild(block);
		}

		if (this.state.getProp("author_write_only")) {
			const block = document.createElement("div");
			block.className = "flex flex-row items-center gap-2";
			const img = document.createElement("img");
			img.src = EyeIcon;
			img.className = "w-[20px] h-[20px]";
			const content = document.createElement("span");
			content.innerText = Model.getPipe("locale.getLocalized").run("topics.author_write_only");
			block.appendChild(img);
			block.appendChild(content);
			this.refs.features.appendChild(block);
		}

		if (this.refs.features.children.length === 0) {
			this.refs.fb.style.display = "none";
		}
	}

	enter () {
		const sp = window.location.pathname.split("/");
		const topic_node = sp[1];

		Model.getPipe("router").run(`${topic_node}/topic/${this.state.getProp("id")}`);
	}
}