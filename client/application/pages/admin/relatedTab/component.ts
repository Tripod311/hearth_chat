import { Component, TemplateCache } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../../../model/main.js"
import RelatedNodeView from "./relatedNodeView.html?raw"
import HandshakeView from "./handshakeView.html?raw"
TemplateCache.registerDrop("relatedNodeView", RelatedNodeView);
TemplateCache.registerDrop("handshakeView", HandshakeView);

export default class RelatedTab extends Component {
	protected static componentName = "RelatedTab";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.handshake.onclick = this.sendHandshake.bind(this);

		this.fetchNodes();
		this.fetchHandshakes();
	}

	async fetchNodes () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.related.fetchRelated").run("self");

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.slots.nodes.clear();

			for (const n of response.data) {
				const drop = TemplateCache.createDrop("relatedNodeView", { title: n.title, description: n.description });
				drop.refs.copyLink.onclick = this.copyLink.bind(this, n.uuid);
				drop.refs.enter.onclick = this.enter.bind(this, n.uuid);
				drop.refs.forget.onclick = this.forgetNode.bind(this, n.uuid);
				this.slots.nodes.push(Component.generic({}, drop.node));
			}
		}
	}

	async fetchHandshakes () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.related.fetchHandshakes").run({});

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.slots.handshakes.clear();

			for (const n of response.data) {
				const drop = TemplateCache.createDrop("handshakeView", { message: n.message });
				drop.refs.accept.onclick = this.acceptHandshake.bind(this, n.id);
				drop.refs.decline.onclick = this.rejectHandshake.bind(this, n.id);
				this.slots.handshakes.push(Component.generic({}, drop.node));
			}
		}
	}

	async sendHandshake () {
		const link = this.refs.link.value.trim();
		const message = this.refs.message.value.trim();

		if (link.length > 0) {
			const spinner = Model.getPipe("modals.createSpinner").run();
			Model.getPipe("modals.showDialog").run(spinner);

			const response = await Model.getPipe("api.related.sendHandshake").run({ link, message });

			spinner.emit("close");

			if (response.error) {
				const notification = Model.getPipe("modals.createNotification").run({
					message: response.details,
					buttonValue: "Ok"
				});
				Model.getPipe("modals.showDialog").run(notification);
			} else {
				await this.fetchNodes();
			}
		}
	}

	async copyLink (uuid: string) {
		await navigator.clipboard.writeText(`/${uuid}/title`);
	}

	enter (uuid: string) {
		Model.getPipe("router").run(`${uuid}/title`);
	}

	forgetNode (uuid: string) {
		const prompt = Model.getPipe("modals.createPrompt").run({
			message: `Forget node?`,
			callback: async (password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.related.forgetRelated").run(uuid);

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					await this.fetchNodes();
				}
			}
		});
		Model.getPipe("modals.showDialog").run(prompt);
	}

	acceptHandshake (id: number) {
		const prompt = Model.getPipe("modals.createPrompt").run({
			message: `Accept?`,
			callback: async (password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.related.acceptHandshake").run(id);

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					await this.fetchHandshakes();
					await this.fetchNodes();
				}
			}
		});
		Model.getPipe("modals.showDialog").run(prompt);
	}

	rejectHandshake (id: number) {
		const prompt = Model.getPipe("modals.createPrompt").run({
			message: `Decline?`,
			callback: async (password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.related.rejectHandshake").run(id);

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					await this.fetchHandshakes();
					await this.fetchNodes();
				}
			}
		});
		Model.getPipe("modals.showDialog").run(prompt);
	}
}