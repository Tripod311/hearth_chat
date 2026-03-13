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
			this.refs.name.value = response.data.name;
			this.refs.description.value = response.data.description;
			this.refs.title_page.value = response.data.title_page;
			this.refs.http_port.value = response.data.http_port;
			this.refs.gate_port.value = response.data.gate_port;
		}
	}

	async submitSettings () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		try {
			const val = {
				name: this.refs.name.value,
				description: this.refs.description.value,
				title_page: JSON.parse(this.refs.title_page.value),
				http_port: parseInt(this.refs.http_port.value),
				gate_port: parseInt(this.refs.gate_port.value)
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