import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../../../model/main.js"

import SetPasswordDialog from "./dialogs/setPasswordDialog.js"
import CreateUserDialog from "./dialogs/createUserDialog.js"
import CreateInviteDialog from "./dialogs/createInviteDialog.js"
import EditUserDialog from "./dialogs/editUserDialog.js"

interface UserData {
	login: string;
	is_admin: number;
	is_bot: number;
	last_login: number;
	element?: HTMLElement;
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

		this.state.update({
			login: Model.getPipe("locale.getLocalized").run("common.login"),
			is_admin: Model.getPipe("locale.getLocalized").run("admin.is_admin"),
			is_bot: Model.getPipe("locale.getLocalized").run("admin.is_bot"),
			last_login: Model.getPipe("locale.getLocalized").run("admin.last_login")
		});

		this.refs.createInvite.onclick = this.createInvite.bind(this);
		this.refs.createInvite.innerText = Model.getPipe("locale.getLocalized").run("admin_user.createInvite");
		this.refs.createUser.onclick = this.createUser.bind(this);
		this.refs.createUser.innerText = Model.getPipe("locale.getLocalized").run("admin_user.createUser");
		this.refs.editUser.onclick = this.editUser.bind(this);
		this.refs.editUser.innerText = Model.getPipe("locale.getLocalized").run("admin_user.editUser");
		this.refs.setPassword.onclick = this.setPassword.bind(this);
		this.refs.setPassword.innerText = Model.getPipe("locale.getLocalized").run("admin_user.setPassword");
		this.refs.deleteUser.onclick = this.deleteUser.bind(this);
		this.refs.deleteUser.innerText = Model.getPipe("locale.getLocalized").run("admin_user.deleteUser");

		this.refs.prev.onclick = this.prevPage.bind(this);
		this.refs.prev.innerText = Model.getPipe("locale.getLocalized").run("common.prev");
		this.refs.next.onclick = this.nextPage.bind(this);
		this.refs.next.innerText = Model.getPipe("locale.getLocalized").run("common.next");
		this.refs.search.onclick = this.search.bind(this);
		this.refs.search.innerText = Model.getPipe("locale.getLocalized").run("common.search");

		this.fetchUsers();
	}

	async fetchUsers () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.user.getUsers").run({
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

			this.data = response.data as UserData[];

			for (let index = 0; index<this.data.length; index++) {
				const row = this.data[index];

				const tr = document.createElement("tr");
				tr.style.cursor = "pointer";
				let td = document.createElement("td");
				td.innerText = row.login;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.is_admin;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.is_bot;
				tr.appendChild(td);
				td = document.createElement("td");
				td.innerText = row.last_login;
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

			this.refs.setPassword.style.display = "block";
			this.refs.editUser.style.display = "block";
			this.refs.deleteUser.style.display = "block";
		} else {
			this.refs.setPassword.style.display = "none";
			this.refs.editUser.style.display = "none";
			this.refs.deleteUser.style.display = "none";
		}
	}

	async createInvite () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.user.createInvite").run();

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			const dlg = new CreateInviteDialog({
				link: `${window.location.origin}/invite/${response.invite}`
			});
			Model.getPipe("modals.showDialog").run(dlg);
		}
	}

	createUser () {
		const dlg = new CreateUserDialog({
			callback: async (login: string, password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.user.addUser").run({ login, password });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Created",
						buttonValue: "Ok",
						callback: () => {
							this.selectRow(-1);
							this.fetchUsers();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(dlg);
	}

	editUser () {
		const row = this.data[this.selectedRow];

		const dlg = new EditUserDialog({
			is_admin: row.is_admin,
			is_bot: row.is_bot,
			callback: async (is_admin: boolean, is_bot: boolean) => {
				const login = this.data[this.selectedRow].login;

				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.user.editUser").run({ login, is_admin, is_bot });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: "Updated",
						buttonValue: "Ok",
						callback: () => {
							this.selectRow(-1);
							this.fetchUsers();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(dlg);
	}

	setPassword () {
		const dlg = new SetPasswordDialog({
			callback: async (password: string) => {
				const login = this.data[this.selectedRow].login;

				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.user.setPassword").run({ login, password });

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

	deleteUser () {
		const login = this.data[this.selectedRow].login;

		const prompt = Model.getPipe("modals.createPrompt").run({
			message: `${Model.getPipe("locale.getLocalized").run("common.delete")} ${login}?`,
			callback: async (password: string) => {
				const spinner = Model.getPipe("modals.createSpinner").run();
				Model.getPipe("modals.showDialog").run(spinner);

				const response = await Model.getPipe("api.user.deleteUser").run({ login });

				spinner.emit("close");

				if (response.error) {
					const notification = Model.getPipe("modals.createNotification").run({
						message: response.details,
						buttonValue: "Ok"
					});
					Model.getPipe("modals.showDialog").run(notification);
				} else {
					const notification = Model.getPipe("modals.createNotification").run({
						message: Model.getPipe("locale.getLocalized").run("common.success"),
						buttonValue: Model.getPipe("locale.getLocalized").run("common.ok"),
						callback: () => {
							this.selectRow(-1);
							this.fetchUsers();
						}
					});
					Model.getPipe("modals.showDialog").run(notification);
				}
			}
		});
		Model.getPipe("modals.showDialog").run(prompt);
	}

	prevPage () {
		this.offset = Math.max(this.offset - this.limit, 0);
	}

	nextPage () {
		this.offset += this.limit;

		this.fetchUsers();
	}

	search () {
		this.offset = 0;
		this.filter = this.refs.filter.value;

		this.fetchUsers();
	}
}