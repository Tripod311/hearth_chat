import { Component } from "@tripod311/splash"
import View from "./setNameDialog.html?raw"

import Model from "../../../../model/main.js"

export default class SetNameDialog extends Component {
	protected static componentName = "SetNameDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.state.update({
			"name-loc": Model.getPipe("locale.getLocalized").run("common.name")
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
		const name = this.refs.name.value;

		this.emit("close");
		
		this.state.getProp("callback")(name);
	}

	onCancel () {
		this.emit("close");
	}
}