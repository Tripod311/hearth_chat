import { Component } from "@tripod311/splash"
import View from "./notificationDialog.html?raw"

export default class NotificationDialog extends Component {
	protected static componentName = "NotificationDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.button.onclick = this.callback.bind(this);
	}

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}

	callback () {
		const cb = this.state.getProp("callback");

		this.emit("close");

		if (cb) cb();
	}
}