import { Component } from "@tripod311/splash"
import View from "./createUserDialog.html?raw"

export default class CreateUserDialog extends Component {
	protected static componentName = "CreateUserDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.okButton.onclick = this.onOk.bind(this);
		this.refs.cancelButton.onclick = this.onCancel.bind(this);
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