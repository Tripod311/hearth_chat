import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../../../model/main.js"

interface ActorData {
	id: number;
	node_id: string;
	node_title: string;
	node_user_id: number;
	display_name: string;
	is_banned: boolean;
	element?: HTMLElement;
}

export default class ActorsTab extends Component {
	protected static componentName = "ActorsTab";
	protected static template = View;

	private filter: string = "";
	private offset: number = 0;
	private limit: number = 20;
	private data: UserData[] = [];
	private selectedRow: number = -1;

	mounted () {
		super.mounted();

		this.state.update({
			nodeId: Model.getPipe("locale.getLocalized").run("admin_actor.nodeId"),
			nodeTitle: Model.getPipe("locale.getLocalized").run("admin_actor.nodeTitle"),
			actorId: Model.getPipe("locale.getLocalized").run("admin_actor.actorId"),
			actorName: Model.getPipe("locale.getLocalized").run("admin_actor.actorName"),
			banned: Model.getPipe("locale.getLocalized").run("admin.banned")
		});

		this.refs.toggleBan.onclick = this.toggleBan.bind(this);

		this.refs.prev.onclick = this.prevPage.bind(this);
		this.refs.prev.innerText = Model.getPipe("locale.getLocalized").run("common.prev");
		this.refs.next.onclick = this.nextPage.bind(this);
		this.refs.next.innerText = Model.getPipe("locale.getLocalized").run("common.next");
		this.refs.search.onclick = this.search.bind(this);
		this.refs.search.innerText = Model.getPipe("locale.getLocalized").run("common.search");

		this.fetchActors();
	}

	async fetchActors () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.actor.getActors").run({
			filter: this.filter,
			offset: this.offset,
			limit: this.limit
		});

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			this.refs.tbody.innerHTML = "";

			this.data = response.data as ActorData[];

			for (let index = 0; index<this.data.length; index++) {
				const row = this.data[index];

				const tr = document.createElement("tr");
				tr.style.cursor = "pointer";
				let td = document.createElement("td");
				td.innerText = row.node_id;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.node_title;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.node_user_id;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.display_name;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.is_banned;
				tr.appendChild(td);
				this.refs.tbody.appendChild(tr);

				tr.onclick = this.selectRow.bind(this, index);
				this.data[index].element = tr;
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

			this.refs.toggleBan.style.display = "block";
			this.refs.toggleBan.innerText = this.data[this.selectedRow].is_banned ? Model.getPipe("locale.getLocalized").run("admin.unban") : Model.getPipe("locale.getLocalized").run("admin.ban");
		} else {
			this.refs.toggleBan.style.display = "none";
		}
	}

	prevPage () {
		this.offset = Math.max(this.offset - this.limit, 0);
	}

	nextPage () {
		this.offset += this.limit;

		this.fetchActors();
	}

	search () {
		this.offset = 0;
		this.filter = this.refs.filter.value;

		this.fetchActors();
	}

	async toggleBan () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const row = this.data[this.selectedRow];
		this.selectRow(-1);

		if (row.is_banned) {
			const response = await Model.getPipe("api.actor.unban").run(row.id);

			spinner.emit("close");

			this.fetchActors();
		} else {
			const response = await Model.getPipe("api.actor.ban").run(row.id);

			spinner.emit("close");

			this.fetchActors();
		}
	}
}