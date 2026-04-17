import { Component } from "@tripod311/splash"
import View from "./navigation.html?raw"
import Model from "../../model/main.js"

export default class Navigation extends Component {
	protected static componentName = "Navigation";
	protected static template = View;

	private adminListener: () => void;
	private localeListener: () => void;

	constructor (options: Record<string, any>) {
		super(options);

		this.adminListener = this.adminChange.bind(this);
		this.localeListener = this.updateLocale.bind(this);
	}

	mounted () {
		super.mounted();

		Model.getPipe("settings.isAdmin").on(this.adminListener);
		Model.getPipe("locale.current").on(this.localeListener);

		this.refs.account.onclick = this.goToAccount.bind(this);
		this.refs.title.onclick = this.goToTitle.bind(this);
		this.refs.home.onclick = this.goHome.bind(this);
		this.refs.topics.onclick = this.goToTopics.bind(this);
		this.refs.related.onclick = this.goToRelated.bind(this);
		this.refs.admin.onclick = this.goToAdmin.bind(this);

		this.adminChange();
		this.updateLocale();
	}

	unmounted () {
		Model.getPipe("settings.isAdmin").off(this.adminListener);
		Model.getPipe("locale.current").off(this.localeListener);

		super.unmounted();
	}

	adminChange () {
		if (!Model.getPipe("settings.isAdmin").data) this.refs.admin.style.display = "none";
		else this.refs.admin.style.display = "block";
	}

	updateLocale () {
		this.refs.account.innerText = Model.getPipe("locale.getLocalized").run("navigation.account");
		this.refs.admin.innerText = Model.getPipe("locale.getLocalized").run("navigation.admin");
		this.refs.home.innerText = Model.getPipe("locale.getLocalized").run("navigation.home");
		this.refs.title.innerText = Model.getPipe("locale.getLocalized").run("navigation.title");
		this.refs.topics.innerText = Model.getPipe("locale.getLocalized").run("navigation.topics");
		this.refs.related.innerText = Model.getPipe("locale.getLocalized").run("navigation.related");
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

	goHome () {
		this.emit("hide");

		Model.getPipe("settings.currentNode").data = "self";

		Model.getPipe("router").run(`self/title`);
	}

	goToTitle () {
		this.emit("hide");

		Model.getPipe("router").run(`${Model.getPipe("settings.currentNode").data}/title`);
	}

	goToTopics () {
		this.emit("hide");

		Model.getPipe("router").run(`${Model.getPipe("settings.currentNode").data}/topics`);
	}

	goToRelated () {
		this.emit("hide");

		Model.getPipe("router").run(`${Model.getPipe("settings.currentNode").data}/related`);
	}

	goToAdmin () {
		this.emit("hide");
		Model.getPipe("router").run('admin');
	}
}