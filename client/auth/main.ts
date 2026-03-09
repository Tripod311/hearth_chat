import { Component } from "@tripod311/splash"
import View from "./main.html?raw"

import Modals from "../modals/modals.js"
import SpinnerDialog from "../modals/dialogs/spinnerDialog.js"
import NotificationDialog from "../modals/dialogs/notificationDialog.js"
import Model from "../model/main.js"

export default class Auth extends Component {
	protected static componentName = "AuthForm";
	protected static template = View;

	private modals: Modals = new Modals();

	mounted () {
		super.mounted();

		this.slots.modals.push(this.modals);
		this.refs.button.onclick = this.handleSubmit.bind(this);
	}

	async handleSubmit () {
		const login = this.refs.login.value;
		const password = this.refs.password.value;

		if (login.length === 0 || password.length === 0) {
			const errDlg = new NotificationDialog({
				message: "Login and password required",
				buttonValue: "Ok"
			});

			this.modals.showDialog(errDlg);
			return;
		}

		const spinnerDialog = new SpinnerDialog({});

		this.modals.showDialog(spinnerDialog);

		const response = await Model.getPipe("api.user.login").run({ login, password });

		spinnerDialog.emit("close");

		if (response.error) {
			const errDlg = new NotificationDialog({
				message: response.details,
				buttonValue: "Ok"
			});

			this.modals.showDialog(errDlg);
		} else {
			Model.getPipe("router").run("self/title");
		}
	}
}