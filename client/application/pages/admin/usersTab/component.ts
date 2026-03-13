import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

interface UserData {
	login: string;
	is_admin: number;
	is_bot: number;
	last_login: number;
}

export default class UsersTab extends Component {
	protected static componentName = "UsersTab";
	protected static template = View;

	private filter: string = "";
	private offset: number = 0;
	private limit: number = 20;
	private data: UserData[] = [];
	private selectedRow: number = -1;

	mounted () {
		super.mounted();

		this.fetchUsers();
	}

	async fetchUsers () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.nodeInfo.getUsers").run({
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
			this.data = response.data as UserData[];

			// fill table
		}
	}
}