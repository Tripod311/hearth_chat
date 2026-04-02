import { Component } from "@tripod311/splash"
import View from "./messageAttachment.html?raw"

import Model from "../../../../model/main.js"

import FileIcon from "../../../../icons/file.svg"
import FileViewer from "./fileViewer.js"

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
			case "webp":
				this.refs.image.src = this.fullLink;
				break;
			default:
				this.refs.image.src = FileIcon;
				break;
		}

		this.refs.container.onclick = this.open.bind(this);
	}

	open () {
		const link = this.state.getProp("link");
		let ext = "";

		if (link.indexOf(".") !== -1) {
			const lsp = link.split('.');
			ext = lsp[lsp.length - 1];
		}

		switch (ext) {
			case "png":
			case "jpg":
			case "jpeg":
			case "webp":
			case "mp4":
			case "webm":
			case "mp3":
			case "wav":
			case "ogg":
			case "m4a":
				this.openViewer();
				break;
			default:
				this.downloadFile();
				break;
		}
	}

	async downloadFile () {
		const link = this.state.getProp("link");
		let ext = "";

		if (link.indexOf(".") !== -1) {
			const lsp = link.split('.');
			ext = lsp[lsp.length - 1];
		}

		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		try {
			const res = await fetch(this.fullLink, {
				credentials: 'include'
			});

			if (!res.ok) {
				throw new Error('Download failed');
			}

			const blob = await res.blob();
			const blobUrl = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = ext.length > 0 ? `hearthChat_download.${ext}` : `hearthChat_download`;
			document.body.appendChild(a);
			a.click();
			a.remove();

			URL.revokeObjectURL(blobUrl);

			spinner.emit("close");
		} catch (err: any) {
			spinner.emit("close");

			const notification = Model.getPipe("modals.createNotification").run({
				message: err.toString(),
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		}
	}

	openViewer () {
		const viewer = new FileViewer({
			link: this.fullLink
		});
		Model.getPipe("modals.showDialog").run(viewer);
	}
}