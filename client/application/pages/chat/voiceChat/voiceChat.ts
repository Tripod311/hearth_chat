import { Component, TemplateCache } from "@tripod311/splash"
import View from "./voiceChat.html?raw"

import Model from "../../../../model/main.js"

import CloseIcon from "../../../../icons/delete.svg"
import Block from "./block.html?raw"

TemplateCache.registerDrop("voiceChatBlock", Block);

export default class VoiceChat extends Component {
	protected static componentName = "VoiceChat";
	protected static template = View;

	private connectionState: boolean = false;
	private opened: boolean = false;
	private blocks: Record<number, { audio?: HTMLElement; video?: HTMLElement; display: HTMLElement; }> = {};

	mounted () {
		super.mounted();
		window.shit = this;

		this.refs.closeControls.src = CloseIcon;
		this.refs.closeControls.onclick = this.emit.bind(this, "toggle");
		this.refs.connect.onclick = this.onConnect.bind(this);

		this.state.getProp("controls").onupdate = this.onUpdate.bind(this);
		this.state.getProp("controls").onconsumerready = this.setConsumer.bind(this);
	}

	open () {
		this.refs.container.style.width = "100%";
		this.refs.container.style.height = "100%";
		this.opened = true;

		if (this.connectionState) this.fill();
	}

	close () {
		this.refs.container.style.width = "0";
		this.refs.container.style.height = "0";
		this.opened = false;

		for (const id in this.blocks) {
			this.blocks[id].video?.remove();
			delete this.blocks[id].video;
		}
	}

	async onConnect () {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true
			});

			if (stream) {
				this.state.getProp("controls").createTransport(stream);
				this.refs.connect.style.display = "none";
				this.refs.connectMessage.innerText = "Connecting...";
			}
		} catch (err: any) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: `Error: ${err.message || err.toString()}`,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		}
	}

	onUpdate () {
		const controls = this.state.getProp("controls");

		if (controls.connected !== this.connectionState) {
			this.connectionState = controls.connected;

			this.refs.connect.style.display = "block";
			this.refs.connectMessage.innerText = "Connect with voice/video";

			if (controls.connected) {
				this.refs.inactive.style.display = "none";
				this.refs.active.style.display = "block";
			} else {
				this.refs.inactive.style.display = "flex";
				this.refs.active.style.display = "none";
			}
		}

		if (this.opened) this.fill();
	}

	fill () {
		const controls = this.state.getProp("controls");
		const state = controls.state;

		// delete disconnected
		const toDelete = new Set(Object.keys(this.blocks));
		const real = new Set(Object.keys(state));

		for (const id of real) {
			toDelete.delete(id);
		}

		for (const id of toDelete) {
			this.blocks[id].audio?.remove();
			this.blocks[id].video?.remove();
			this.blocks[id].display.remove();
			delete this.blocks[id];
		}

		// create new blocks
		for (const id of real) {
			if (!this.blocks[id]) {
				this.blocks[id] = {
					display: TemplateCache.createDrop("voiceChatBlock", { display_name: state[id].display_name }).node
				};
			}

			if (state[id].audio && !this.blocks[id].audio) {
				this.blocks[id].audio = document.createElement("audio");
				this.refs.audioDump.appendChild(this.blocks[id].audio);

				const stream = controls.getAudioStream(id);
				if (stream) {
					this.blocks[id].audio.srcObject = stream;
					this.blocks[id].audio.play();
				}
			} else if (!state[id].audio && this.blocks[id].audio) {
				this.blocks[id].audio.remove();
				delete this.blocks[id].audio;
			}

			if (state[id].video && !this.blocks[id].video) {
				this.blocks[id].video = document.createElement("video");
				this.blocks[id].video.muted = true;
				this.blocks[id].video.className = "w-full h-full object-cover";
				this.blocks[id].display.appendChild(this.blocks[id].video);

				const stream = controls.getVideoStream(id);
				if (stream) {
					this.blocks[id].video.srcObject = stream;
					this.blocks[id].video.play();
				}
			} else if (!state[id].video && this.blocks[id].video) {
				this.blocks[id].video.remove();
			}

			this.refs.blocks.appendChild(this.blocks[id].display);
		}
	}

	setConsumer (id: number, kind: string) {
		if (this.blocks[id]) {
			if (kind === "audio" && this.blocks[id].audio !== undefined) {
				this.blocks[id].audio.srcObject = this.state.getProp("controls").getAudioStream(id);
				this.blocks[id].audio.play();
			} else if (kind === "video" && this.blocks[id].video !== undefined) {
				this.blocks[id].video.srcObject = this.state.getProp("controls").getAudioStream(id);
				this.blocks[id].video.play();
			}
		}
	}
}