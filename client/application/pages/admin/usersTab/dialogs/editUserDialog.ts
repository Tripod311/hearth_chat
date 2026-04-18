import { Component } from "@tripod311/splash"
import View from "./editUserDialog.html?raw"

import Model from "../../../../../model/main.js"

export default class EditUserDialog extends Component {
	protected static componentName = "EditUserDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.state.update({
			is_admin: Model.getPipe("locale.getLocalized").run("admin.is_admin"),
			is_bot: Model.getPipe("locale.getLocalized").run("admin.is_bot")
		});

		this.refs.is_admin.checked = this.state.getProp("is_admin");
		this.refs.is_bot.checked = this.state.getProp("is_bot");

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
		this.emit("close");
		
		this.state.getProp("callback")(Number(this.refs.is_admin.checked), Number(this.refs.is_bot.checked));
	}

	onCancel () {
		this.emit("close");
	}
}