import { Component } from "@tripod311/splash"
import View from "./promptDialog.html?raw"

export default class PromptDialog extends Component {
	protected static componentName = "PromptDialog";
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
		const cb = this.state.getProp("callback");

		this.emit("close");

		cb();
	}

	onCancel () {
		this.emit("close");
	}
}