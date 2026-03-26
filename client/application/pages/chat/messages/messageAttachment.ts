import { Component } from "@tripod311/splash"
import View from "./messageAttachment.html?raw"

import FileIcon from "../../../../icons/file.svg"

export default class MessageAttachment extends Component {
	protected static componentName = "MessageAttachment";
	protected static template = View;

	private fullLink!: string;

	mounted () {
		super.mounted();

		const link = this.state.getProp("link");
		const sp = window.location.pathname.split("/");
		const topic_node = sp[1];
		this.fullLink = `${window.location.origin}/${topic_node}/files/${link}`;
		let ext = "";

		if (link.indexOf(".") !== -1) {
			const lsp = link.split('.');
			ext = lsp[lsp.length - 1];
		}

		switch (ext) {
			case "png":
			case "jpg":
			case "jpeg":
				this.refs.image.src = this.fullLink;
				break;
			default:
				this.refs.image.src = FileIcon;
				break;
		}

		this.refs.container.onclick = this.open.bind(this);
	}

	open () {
		window.open(this.fullLink);
	}
}