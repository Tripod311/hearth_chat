import { Component, TemplateCache } from "@tripod311/splash"
import View from "./related.html?raw"

import Model from "../../../model/main.js"

export default class RelatedPage extends Component {
	protected static componentName = "RelatedPage";
	protected static template = View;

	mounted () {
		super.mounted();

		this.fetchNodes();
	}

	async fetchNodes () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.related.fetchRelated").run(Model.getPipe("settings.currentNode").data);

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.slots.content.clear();

			for (const n of response.data) {
				const drop = TemplateCache.createDrop("relatedNodeView", { uuid: n.uuid, title: n.title, description: n.description });
				drop.refs.forget.style.display = "none";
				drop.refs.copyLink.style.display = "none";
				drop.refs.enter.style.display = "none";
				drop.refs.uuid.style.display = "none";
				drop.refs.container.onclick = this.goTo.bind(this, n.uuid);
				drop.refs.container.style.cursor = "pointer";
				this.slots.content.push(Component.generic({}, drop.node));
			}
		}
	}

	async goTo (uuid: string) {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const nodeId = Model.getPipe("settings.currentNode").data;

		const response = await Model.getPipe("api.related.goTo").run({
			from: nodeId,
			to: uuid
		});

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			if (response.selfId) {
				Model.getPipe("settings.currentNode").data = "self";
				Model.getPipe("router").run(`self/title`);
			} else {
				Model.getPipe("settings.currentNode").data = uuid;
				Model.getPipe("router").run(`${uuid}/title`);
			}
		}
	}
}