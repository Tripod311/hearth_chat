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
	private localeListener: () => void;

	constructor (options: Record<string, any>) {
		super(options);

		this.localeListener = this.updateLocale.bind(this);
	}

	mounted () {
		super.mounted();

		this.slots.modals.push(this.modals);
		this.refs.button.onclick = this.handleSubmit.bind(this);

		Model.getPipe("locale.current").on(this.localeListener);

		this.updateLocale();
	}

	unmounted () {
		Model.getPipe("locale.current").off(this.localeListener);

		super.unmounted();
	}

	updateLocale () {
		this.refs.button.innerText = Model.getPipe("locale.getLocalized").run("common.enter");
		this.refs.loginTitle.innerText = Model.getPipe("locale.getLocalized").run("common.login");
		this.refs.passwordTitle.innerText = Model.getPipe("locale.getLocalized").run("common.password");
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