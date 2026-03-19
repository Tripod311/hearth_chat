import { Component, TemplateCache } from "@tripod311/splash"
import View from "./account.html?raw"

import Model from "../../../model/main.js"
import SetPasswordDialog from "../admin/usersTab/dialogs/setPasswordDialog.js"
import SetNameDialog from "./dialogs/setNameDialog.js"
import TopicDialog from "./dialogs/topicDialog.js"

import TopicDescription from "./topicDescription.html?raw"
TemplateCache.registerDrop("topicDescription", TopicDescription);

interface TopicInfo {
	id: number;
	title: string;
	description: string;
	guest_access: number;
	author_write_only: number;
	password: number;
	created_at: number;
}

export default class AccountPage extends Component {
	protected static componentName = "AccountPage";
	protected static template = View;

	private data: Record<number, TopicInfo> = {};

	mounted () {
		super.mounted();

		this.refs.changeName.onclick = this.changeName.bind(this);
		this.refs.changePassword.onclick = this.changePassword.bind(this);
		this.refs.createTopic.onclick = this.createTopic.bind(this);

		this.fetchData();
	}

	async fetchData () {
		await this.fetchName();
		await this.fetchTopics();
	}

	async fetchName () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.user.getDisplayName").run();

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.refs.displayName.innerText = response.data;
		}
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
				const drop = TemplateCache.createDrop("topicDescription", this.data[index]);
				drop.refs.enter.onclick = this.enterTopic.bind(this, index);
				drop.refs.edit.onclick = this.editTopic.bind(this, index);
				drop.refs.delete.onclick = this.deleteTopic.bind(this, index);

				this.refs.topics.appendChild(drop.node);
			}
		}
	}

	changeName () {
		const dlg = new SetNameDialog({
			callback: async (displayName: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.user.setDisplayName").run({ displayName });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					this.refs.displayName.innerText = displayName;
				}
			}
		});

		Model.getPipe("modals.showDialog").run(dlg);
	}

	changePassword () {
		const dlg = new SetPasswordDialog({
			callback: async (password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.user.setPassword").run({ password });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Successfully changed",
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(dlg);
	}

	createTopic () {
		const dlg = new TopicDialog({
			callback: async (data: any) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.topic.create").run(data);

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Successfully created",
						buttonValue: "Ok",
						callback: () => {
							this.fetchTopics();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(dlg);
	}

	enterTopic (index: number) {
		const id = this.data[index].id;

		Model.getPipe("router").run(`self/topic/${id}`);
	}

	editTopic (index: number) {
		const dlg = new TopicDialog({
			data: this.data[index],
			callback: async (data: any) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.topic.update").run(data);

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Successfully updated",
						buttonValue: "Ok",
						callback: () => {
							this.fetchTopics();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(dlg);
	}

	deleteTopic (index: number) {
		const dlg = Model.getPipe("modals.createPrompt").run({
			message: "Are you sure?",
			callback: async () => {
				const id = this.data[index].id;

				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.topic.delete").run({ id });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Successfully deleted",
						buttonValue: "Ok",
						callback: () => {
							this.fetchTopics();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(dlg);
	}
}