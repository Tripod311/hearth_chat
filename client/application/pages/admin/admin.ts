import { Component } from "@tripod311/splash"
import View from "./admin.html?raw"

import Model from "../../../model/main.js"

import NodeTab from "./nodeTab/component.js"
import UsersTab from "./usersTab/component.js"
import TopicsTab from "./topicsTab/component.js"
import RelatedTab from "./relatedTab/component.js"
import ActorsTab from "./actorsTab/component.js"

export default class AdminPage extends Component {
	protected static componentName = "AdminPage";
	protected static template = View;

	private selectedTab: string = "node";

	mounted () {
		super.mounted();

		this.refs.node.onclick = this.setTab.bind(this, "node");
		this.refs.node.innerText = Model.getPipe("locale.getLocalized").run("admin.nodeTab");
		this.refs.users.onclick = this.setTab.bind(this, "users");
		this.refs.users.innerText = Model.getPipe("locale.getLocalized").run("admin.usersTab");
		this.refs.actors.onclick = this.setTab.bind(this, "actors");
		this.refs.actors.innerText = Model.getPipe("locale.getLocalized").run("admin.actorsTab");
		this.refs.topics.onclick = this.setTab.bind(this, "topics");
		this.refs.topics.innerText = Model.getPipe("locale.getLocalized").run("admin.topicsTab");
		this.refs.related.onclick = this.setTab.bind(this, "related");
		this.refs.related.innerText = Model.getPipe("locale.getLocalized").run("admin.relatedTab");

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
			case "actors":
				this.slots.tab.push(new ActorsTab({}));
				break;
			case "topics":
				this.slots.tab.push(new TopicsTab({}));
				break;
			case "related":
				this.slots.tab.push(new RelatedTab({}));
				break;
		}
	}
}