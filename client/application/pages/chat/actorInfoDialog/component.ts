import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../../../model/main.js"

export default class ActorInfoDialog extends Component {
	protected static componentName = "ActorInfoDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		if (Model.getPipe("settings.isAdmin").data && Model.getPipe("settings.currentNode").data === "self") {
			this.refs.ban.onclick = this.ban.bind(this);
			this.refs.unban.onclick = this.unban.bind(this);
		} else {
			this.refs.ban.style.display = "none";
			this.refs.unban.style.display = "none";
		}

		this.refs.close.onclick = this.emit.bind(this, "close");

		this.fetchInfo();
	}

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}

	async fetchInfo () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		this.emit("subdialog", spinner);

		const response = await Model.getPipe("api.actor.getActorInfo").run({
			nodeId: Model.getPipe("settings.currentNode").data,
			id: this.state.getProp("id")
		});

		spinner.emit("close");

		if (response.error) {
			const dlg = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Close",
				callback: () => {
					this.emit("close");
				}
			})
		} else {
			this.refs.node_title.innerText = "Node: " + response.data.node_title;
			this.refs.display_name.innerText = "Name: " + response.data.display_name;
			this.refs.is_banned.innerText = response.data.is_banned ? "Banned" : "";
		}
	}

	async ban () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		this.emit("subdialog", spinner);

		const response = await Model.getPipe("api.actor.ban").run(this.state.getProp("id"));

		spinner.emit("close");

		if (response.error) {
			const dlg = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Close",
				callback: () => {
					this.emit("close");
				}
			})
		} else {
			await this.fetchInfo();
		}
	}

	async unban () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		this.emit("subdialog", spinner);

		const response = await Model.getPipe("api.actor.unban").run(this.state.getProp("id"));

		spinner.emit("close");

		if (response.error) {
			const dlg = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Close",
				callback: () => {
					this.emit("close");
				}
			})
		} else {
			await this.fetchInfo();
		}
	}
}