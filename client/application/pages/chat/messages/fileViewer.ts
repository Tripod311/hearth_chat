import { Component } from "@tripod311/splash"
import View from "./fileViewer.html?raw"

import CloseIcon from "../../../../icons/delete.svg"

export default class FileViewer extends Component {
	protected static componentName = "FileViewer";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.close.src = CloseIcon;
		this.refs.close.onclick = this.emit.bind(this, "close");

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
				this.renderImage();
				break;
			case "mp4":
			case "webm":
			case "ogg":
				this.renderVideo();
				break;
			case "mp3":
			case "wav":
			case "m4a":
				this.renderAudio();
				break;
		}
	}

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}

	renderImage () {
		const link = this.state.getProp("link");

		const element = document.createElement("img");
		element.className = "max-w-full max-h-full object-contain";
		element.src = link;

		this.refs.container.appendChild(element);
	}

	renderVideo () {
		const link = this.state.getProp("link");

		const element = document.createElement("video");
		element.className = "max-w-full max-h-full object-contain";
		element.src = link;
		element.controls = true;

		this.refs.container.appendChild(element);
	}

	renderAudio () {
		const link = this.state.getProp("link");

		const element = document.createElement("audio");
		element.className = "max-w-full max-h-full";
		element.src = link;
		element.controls = true;

		this.refs.container.appendChild(element);
	}
}