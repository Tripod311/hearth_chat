import { Component } from "@tripod311/splash"
import View from "./createInviteDialog.html?raw"

import Model from "../../../../../model/main.js"

export default class CreateInviteDialog extends Component {
	protected static componentName = "CreateInviteDialog";
	protected static template = View;

	mounted () {
		super.mounted();

		this.state.update({
			message: Model.getPipe("locale.getLocalized").run("admin_user.inviteMessage")
		})

		this.refs.button.onclick = this.emit.bind(this, "close");
		this.refs.button.innerText = Model.getPipe("locale.getLocalized").run("common.close");
		this.refs.link.onclick = this.copyLink.bind(this)
	}

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}

	async copyLink () {
		await navigator.clipboard.writeText(this.state.getProp("link"));
	}
}