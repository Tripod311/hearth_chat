import { Component } from "@tripod311/splash"
import View from "./createUserDialog.html?raw"

import Model from "../../../../../model/main.js"

export default class CreateUserDialog extends Component {
	protected static componentName = "CreateUserDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.state.update({
			loginTitle: Model.getPipe("locale.getLocalized").run("common.login"),
			passwordTitle: Model.getPipe("locale.getLocalized").run("common.password")
		});

		this.refs.okButton.onclick = this.onOk.bind(this);
		this.refs.okButton.innerText = Model.getPipe("locale.getLocalized").run("common.ok");
		this.refs.cancelButton.onclick = this.onCancel.bind(this);
		this.refs.cancelButton.innerText = Model.getPipe("locale.getLocalized").run("common.cancel");
	}

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}

	onOk () {
		this.refs.login.style.removeProperty("border-color");
		this.refs.password.style.removeProperty("border-color");

		const login = this.refs.login.value;
		const password = this.refs.password.value;

		if (login.length === 0) {
			this.refs.login.style["border-color"] = "red";
			return;
		}

		if (password.length === 0) {
			this.refs.password.style["border-color"] = "red";
			return;
		}

		this.emit("close");
		
		this.state.getProp("callback")(login, password);
	}

	onCancel () {
		this.emit("close");
	}
}