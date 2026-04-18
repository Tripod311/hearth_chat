import { Component } from "@tripod311/splash"
import View from "./setPasswordDialog.html?raw"

import Model from "../../../../../model/main.js"

export default class SetPasswordDialog extends Component {
	protected static componentName = "SetPasswordDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.state.update({
			"password": Model.getPipe("locale.getLocalized").run("common.password"),
			"password-repeat": Model.getPipe("locale.getLocalized").run("common.repeatPassword")
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
		this.refs.password.style.removeProperty("border-color");
		this.refs.repeat.style.removeProperty("border-color");

		const pwd = this.refs.password.value;
		const pwdRepeat = this.refs.repeat.value;

		if (pwd.length === 0) {
			this.refs.password.style["border-color"] = "red";
			return;
		}

		if (pwd !== pwdRepeat) {
			this.refs.password.style["border-color"] = "red";
			this.refs.repeat.style["border-color"] = "red";
			return;
		}

		this.emit("close");
		
		this.state.getProp("callback")(pwd);
	}

	onCancel () {
		this.emit("close");
	}
}