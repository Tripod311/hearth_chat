import { Component } from "@tripod311/splash"
import View from "./admin.html?raw"

import NodeTab from "./nodeTab/component.js"
import UsersTab from "./usersTab/component.js"

export default class AdminPage extends Component {
	protected static componentName = "AdminPage";
	protected static template = View;

	private selectedTab: string = "node";

	mounted () {
		super.mounted();

		this.refs.node.onclick = this.setTab.bind(this, "node");
		this.refs.users.onclick = this.setTab.bind(this, "users");
		this.refs.related.onclick = this.setTab.bind(this, "related");

		this.setTab("node")
	}

	setTab (tabName: string) {
		this.slots.tab.clear();

		this.refs[this.selectedTab].classList.remove("bg-card");
		this.refs[this.selectedTab].classList.add("bg-primary");

		this.selectedTab = tabName;

		this.refs[this.selectedTab].classList.add("bg-card");
		this.refs[this.selectedTab].classList.remove("bg-primary");

		switch (this.selectedTab) {
			case "node":
				this.slots.tab.push(new NodeTab({}));
				break;
			case "users":
				this.slots.tab.push(new UsersTab({}));
				break;
			case "related":
				break;
		}
	}
}