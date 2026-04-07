import { Component, TemplateCache } from "@tripod311/splash"
import View from "./voiceChat.html?raw"

import Model from "../../../../model/main.js"

import CloseIcon from "../../../../icons/delete.svg"
import MicIcon from "../../../../icons/microphone.svg"
import CamIcon from "../../../../icons/camera.svg"
import NoMicIcon from "../../../../icons/microphone-cross.svg"
import NoCamIcon from "../../../../icons/camera-cross.svg"

import Block from "./block.html?raw"
import ConnectionBlock from "./connection.html?raw"

TemplateCache.registerDrop("voiceChatBlock", Block);
TemplateCache.registerDrop("voiceChatConnection", ConnectionBlock);

export default class VoiceChat extends Component {
	protected static componentName = "VoiceChat";
	protected static template = View;

	private opened: boolean = false;
	private timeout?: ReturnType<typeof setTimeout>;
	private blocks: Record<number, { audio?: HTMLElement; video?: HTMLElement; display: HTMLElement; connectionRow: HTMLElement; }> = {};

	mounted () {
		super.mounted();

		this.refs.closeControls.src = CloseIcon;
		this.refs.closeControls.onclick = this.emit.bind(this, "toggle");
		this.refs.connect.onclick = this.toggleConnection.bind(this);
		this.refs.voice.onclick = this.toggleVoice.bind(this);
		this.refs.voice.style.display = "none";
		this.refs.video.onclick = this.toggleVideo.bind(this);
		this.refs.video.style.display = "none";

		this.state.getProp("controls").onupdate = this.onUpdate.bind(this);
		this.state.getProp("controls").onconsumerready = this.setConsumer.bind(this);
	}

	unmounted () {
		clearTimeout(this.timeout);
		
		super.unmounted();
	}

	open () {
		clearTimeout(this.timeout);

		this.refs.container.style.display = "block";
		this.refs.container.style.width = "100%";
		this.refs.container.style.height = "100%";
		this.opened = true;

		if (this.state.getProp("controls").connected) this.fill();
	}

	close () {
		clearTimeout(this.timeout);

		this.refs.container.style.width = "0";
		this.refs.container.style.height = "0";
		this.opened = false;

		for (const id in this.blocks) {
			this.blocks[id].video?.remove();
			delete this.blocks[id].video;
		}

		this.timeout = setTimeout(() => {
			this.refs.container.style.display = "none";
		}, 200);
	}

	toggleConnection () {
		if (this.state.getProp("controls").connected) {
			this.state.getProp("controls").deleteTransport();
			this.refs.connect.innerText = "Connect";
		} else {
			this.state.getProp("controls").createTransport();
			this.refs.connect.innerText = "Connecting...";
		}
	}

	async toggleVoice () {
		const controls = this.state.getProp("controls");

		if (!controls.audioTrack) {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			if (stream) {
				this.state.getProp("controls").audioTrack = stream.getAudioTracks()[0];
			}
		} else {
			controls.audioTrack = undefined;
		}
	}

	async toggleVideo () {
		const controls = this.state.getProp("controls");

		if (!controls.videoTrack) {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true });

			if (stream) {
				this.state.getProp("controls").videoTrack = stream.getVideoTracks()[0];
			}
		} else {
			controls.videoTrack = undefined;
		}
	}

	onUpdate () {
		const controls = this.state.getProp("controls");

		if (controls.connected) {
			this.refs.connect.innerText = "Disconnect";
			this.refs.voice.style.display = "block";
			this.refs.video.style.display = "block";
			this.refs.voice.src = controls.audioTrack ? NoMicIcon : MicIcon;
			this.refs.video.src = controls.videoTrack ? NoCamIcon : CamIcon;
		} else {
			this.refs.connect.innerText = "Connect"
			this.refs.voice.style.display = "none";
			this.refs.video.style.display = "none";
		}

		if (this.opened) this.fill();
	}

	fillAudio () {
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

			if (state[id].audio) {
				this.blocks[id].audio?.remove();

				this.blocks[id].audio = document.createElement("audio");
				this.refs.audioDump.appendChild(this.blocks[id].audio);

				const stream = controls.getAudioStream(id);
				if (stream) {
					this.blocks[id].audio.srcObject = stream;
					this.blocks[id].audio.play();
				}
			} else if (!state[id].audio) {
				this.blocks[id].audio?.remove();
				delete this.blocks[id].audio;
			}
		}
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
			this.blocks[id].display.remove();
			this.blocks[id].connectionRow.remove();
			delete this.blocks[id];
		}

		// create new blocks
		for (const id of real) {
			if (!this.blocks[id]) {
				this.blocks[id] = {
					display: TemplateCache.createDrop("voiceChatBlock", { display_name: state[id].display_name }).node,
					connectionRow: TemplateCache.createDrop("voiceChatConnection", { display_name: state[id].display_name }).node
				};
			}

			if (state[id].audio && (!this.blocks[id].audio || this.blocks[id].audio.srcObject !== controls.getAudioStream(id))) {
				this.blocks[id].audio?.remove();

				this.blocks[id].audio = document.createElement("audio");
				this.refs.audioDump.appendChild(this.blocks[id].audio);

				const stream = controls.getAudioStream(id);
				if (stream) {
					this.blocks[id].audio.srcObject = stream;
					this.blocks[id].audio.play();
				}
			} else if (!state[id].audio) {
				this.blocks[id].audio?.remove();
				delete this.blocks[id].audio;
			}

			if (state[id].video && (!this.blocks[id].video || this.blocks[id].video.srcObject !== controls.getVideoStream(id))) {
				this.blocks[id].video?.remove();

				this.blocks[id].video = document.createElement("video");
				this.blocks[id].video.muted = true;
				this.blocks[id].video.onclick = this.requestFullScreen.bind(this, this.blocks[id].video);
				this.blocks[id].video.className = "w-full h-full object-cover";
				this.blocks[id].display.appendChild(this.blocks[id].video);

				const stream = controls.getVideoStream(id);
				if (stream) {
					this.blocks[id].video.srcObject = stream;
					this.blocks[id].video.play();
				}
			} else if (!state[id].video) {
				this.blocks[id].video?.remove();
			}

			this.refs.blocks.appendChild(this.blocks[id].display);
			this.refs.connections.appendChild(this.blocks[id].connectionRow);
		}
	}

	setConsumer (consumerId: string) {
		if (this.opened) {
			this.fill();
		} else {
			this.fillAudio();
		}
	}

	requestFullScreen (video: HTMLElement) {
		if (video.requestFullscreen) {
			video.requestFullscreen();
		} else if (video.webkitEnterFullscreen) {
			video.webkitEnterFullscreen();
		}
	}
}