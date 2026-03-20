import { Component } from "@tripod311/splash"
import View from "./topicDialog.html?raw"

export default class TopicDialog extends Component {
	protected static componentName = "TopicDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.okButton.onclick = this.onOk.bind(this);
		this.refs.cancelButton.onclick = this.onCancel.bind(this);

		if (this.state.getProp("data")) {
			this.refs.title.value = this.state.getProp("data").title;
			this.refs.description.value = this.state.getProp("data").description;
			this.refs.guest_access.checked = this.state.getProp("data").guest_access;
			this.refs.author_write_only.checked = this.state.getProp("data").author_write_only;
		}
	}

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}

	onOk () {
		const srcData = this.state.getProp("data");

		const data = {
			id: srcData !== undefined ? srcData.id : undefined,
			title: this.refs.title.value,
			description: this.refs.description.value,
			guest_access: this.refs.guest_access.checked,
			author_write_only: this.refs.author_write_only.checked,
			password: this.refs.password.value.length > 0 ? this.refs.password.value : undefined
		}

		this.emit("close");

		this.state.getProp("callback")(data);
	}

	onCancel () {
		this.emit("close");
	}
}