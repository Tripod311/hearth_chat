import { Component } from "@tripod311/splash"
import View from "./account.html?raw"

interface TopicInfo {
	id: number;
	title: string;
	description: string;
	storage_count: number;
	guest_access: number;
	password: number;
	created_at: number;
}

export default class AccountPage extends Component {
	protected static componentName = "AccountPage";
	protected static template = View;

	private data: TopicInfo[] = [];

	mounted () {
		super.mounted();

		this.fetchTopics();
	}

	async fetchTopics () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.topic.myTopics").run();

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.refs.topics.innerHTML = "";

			this.data = response.data as TopicInfo[];

			for (let index = 0; index<this.data.length; index++) {
				
			}
		}
	}
}