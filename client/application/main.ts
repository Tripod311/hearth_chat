import { Component } from "@tripod311/splash"
import View from "./main.html?raw"

import MenuIcon from "../icons/menu.svg"

import Navigation from "./navigation/navigation.js"
import TitlePage from "./pages/title/title.js"

export default class Application extends Component {
	protected static componentName = "Dashboard";
	protected static template = View;

	private navExpanded: boolean = false;

	mounted () {
		super.mounted();

		this.state.setProp("nodeTitle", "HeⒶrthChat");

		this.refs.navButton.src = MenuIcon;
		this.refs.navButton.onclick = this.toggleNav.bind(this);
		this.refs.navCurtain.onclick = this.toggleNav.bind(this);
		this.refs.nav.style.transition = "left 0.3s";
		this.refs.navCurtain.style.transition = "background 0.3s";
		this.slots.navigation.push(new Navigation({}));

		this.setPage();
	}

	toggleNav () {
		this.navExpanded = !this.navExpanded;

		if (this.navExpanded) {
			this.refs.nav.style.left = "0";
			this.refs.navCurtain.style.background = "rgba(0,0,0,0.8)";
			this.refs.navCurtain.style.pointerEvents = "all";
		} else {
			this.refs.nav.style.left = "-300px";
			this.refs.navCurtain.style.background = "transparent";
			this.refs.navCurtain.style.pointerEvents = "none";
		}
	}

	setPage (type="title", id="") {
		this.slots.content.clear();

		switch (type) {
			case "title":
				this.slots.content.push(new TitlePage({}));
				break;
		}
	}
}