import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../../../model/main.js"
import TopicDialog from "../../account/dialogs/topicDialog.js"

interface TopicData {
	id: number;
	title: string;
	creator: string;
	element?: HTMLElement;
}

export default class TopicsTab extends Component {
	protected static componentName = "TopicsTab";
	protected static template = View;

	private data: TopicData[] = [];
	private selectedRow: number = -1;

	mounted () {
		super.mounted();

		this.refs.edit.onclick = this.editSelected.bind(this);
		this.refs.delete.onclick = this.deleteSelected.bind(this);
		this.refs.search.onclick = this.filterChange.bind(this);

		this.fetchTopics();
	}

	async fetchTopics () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.topic.allTopics").run("self");

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.refs.tbody.innerHTML = "";

			this.data = response.data as TopicData[];

			for (let index = 0; index<this.data.length; index++) {
				const row = this.data[index];

				const tr = document.createElement("tr");
				tr.style.cursor = "pointer";
				let td = document.createElement("td");
				td.innerText = row.id;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.title;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.creator_name;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.guest_access;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.password_protected;
				tr.appendChild(td);
				this.refs.tbody.appendChild(tr);

				tr.onclick = this.selectRow.bind(this, index);
				this.data[index].element = tr;
			}

			this.filterChange();
		}
	}

	deleteSelected () {
		const prompt = Model.getPipe("modals.createPrompt").run({
			message: `Delete topic?`,
			callback: async (password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.topic.delete").run({ id: this.data[this.selectedRow].id });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Deleted",
						buttonValue: "Ok",
						callback: () => {
							this.selectRow(-1);
							this.fetchTopics();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(prompt);
	}

	editSelected () {
		const data = this.data[this.selectedRow];

		const dlg = new TopicDialog({
			data: data,
			callback: async (data: Record<string, any>) => {
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

	filterChange () {
		this.selectRow(-1);
		const filterValue = this.refs.filter.value;

		for (const row of this.data) {
			if (row.title.includes(filterValue) || row.creator_name.includes(filterValue)) {
				row.element!.classList.remove("hidden");
			} else {
				row.element!.classList.add("hidden");
			}
		}
	}

	selectRow (index: number) {
		if (this.selectedRow !== -1) {
			this.data[this.selectedRow].element!.style.removeProperty("background");
		}

		this.selectedRow = index;

		if (this.selectedRow !== -1) {
			this.data[this.selectedRow].element!.style.background = "rgba(50, 50, 50)";

			this.refs.edit.style.display = "block";
			this.refs.delete.style.display = "block";
		} else {
			this.refs.edit.style.display = "none";
			this.refs.delete.style.display = "none";
		}
	}
}