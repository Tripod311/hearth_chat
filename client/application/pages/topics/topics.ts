import { Component } from "@tripod311/splash"
import View from "./topics.html?raw"

import Model from "../../../model/main.js"
import AuthorBlock from "./authorBlock.js"

interface TopicInfo {
	id: number;
	creator_name: string;
	creator_id: string;
	title: string;
	description: string;
	password_protected: boolean;
	guest_access: boolean;
	author_write_only: boolean;
}

export default class TopicsPage extends Component {
	protected static componentName = "TopicsPage";
	protected static template = View;

	private structure: Record<number, TopicInfo[]> = {};

	mounted () {
		super.mounted();

		this.fetchContent();
	}

	async fetchContent () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const nodeId = window.location.pathname.split('/')[1];
		const response = await Model.getPipe("api.topic.allTopics").run(nodeId);

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			for (const info of response.data) {
				if (!this.structure[info.creator_id]) {
					this.structure[info.creator_id] = [];
				}

				this.structure[info.creator_id].push(info);
			}

			this.render();
		}
	}

	render () {
		for (const topics of Object.values(this.structure)) {
			const creator_name = topics[0]!.creator_name;
			this.slots.content.push(new AuthorBlock({
				creator_name,
				topics: topics
			}))
		}
	}
}