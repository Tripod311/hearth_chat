import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../../../model/main.js"

export default class NodeTab extends Component {
	protected static componentName = "NodeSettingsTab";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.submit.onclick = this.submitSettings.bind(this);

		this.fetchSettings();
	}

	async fetchSettings () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.nodeInfo.getNodeSettings").run();

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.refs.title.value = response.data.title;
			this.refs.description.value = response.data.description;
			this.refs.title_page.value = response.data.title_page;
			this.refs.http_port.value = response.data.http_port;
			this.refs.gate_port.value = response.data.gate_port;
			this.refs.ice_candidates.value = response.data.ice_candidates;
			this.refs.announced_ip.value = response.data.announced_ip;
		}
	}

	async submitSettings () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		try {
			const val = {
				title: this.refs.title.value,
				description: this.refs.description.value,
				title_page: JSON.stringify(JSON.parse(this.refs.title_page.value)),
				http_port: parseInt(this.refs.http_port.value),
				gate_port: parseInt(this.refs.gate_port.value),
				ice_candidates: this.refs.ice_candidates.value.trim().length > 0 ? JSON.stringify(JSON.parse(this.refs.ice_candidates.value)) : null,
				announced_ip: this.refs.announced_ip.value.trim().length > 0 ? this.refs.announced_ip.value.trim() : null
			};

			if (isNaN(val.http_port) || val.http_port < 0 || isNaN(val.gate_port) || val.gate_port < 0) throw new Error("Invalid port value");

			const response = await Model.getPipe("api.nodeInfo.setNodeSettings").run(val);

			if (response.error) throw new Error(response.details);

			throw new Error("Node settings updated");
		} catch (err: any) {
			spinner.emit("close");

			const notification = Model.getPipe("modals.createNotification").run({
				message: err.toString(),
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		}
	}
}