import { Component } from "@tripod311/splash"
import View from "./navigation.html?raw"
import Model from "../../model/main.js"

export default class Navigation extends Component {
	protected static componentName = "Navigation";
	protected static template = View;

	mounted () {
		super.mounted();

		Model.getPipe("settings.isAdmin").on(this.adminChange.bind(this));

		this.refs.account.onclick = this.goToAccount.bind(this);
		this.refs.title.onclick = this.goToTitle.bind(this);
		this.refs.topics.onclick = this.goToTopics.bind(this);
		this.refs.related.onclick = this.goToRelated.bind(this);
		this.refs.admin.onclick = this.goToAdmin.bind(this);

		this.adminChange();
	}

	adminChange () {
		if (!Model.getPipe("settings.isAdmin").data) this.refs.admin.style.display = "none";
		else this.refs.admin.style.display = "block";
	}

	get nodeId (): string {
		const sp = window.location.pathname.split('/');

		if (sp.length === 2) {
			return 'self';
		} else {
			return sp[1];
		}
	}

	goToAccount () {
		this.emit("hide");
		Model.getPipe("router").run('account');
	}

	goToTitle () {
		this.emit("hide");
		Model.getPipe("router").run(`${this.nodeId}/title`);
	}

	goToTopics () {
		this.emit("hide");
		Model.getPipe("router").run(`${this.nodeId}/topics`);
	}

	goToRelated () {
		this.emit("hide");
		Model.getPipe("router").run(`${this.nodeId}/related`);
	}

	goToAdmin () {
		this.emit("hide");
		Model.getPipe("router").run('admin');
	}
}