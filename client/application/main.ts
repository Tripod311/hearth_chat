import { Pipe, SyncFunctionPipe } from "@tripod311/pump"
import { Component } from "@tripod311/splash"
import View from "./main.html?raw"

import MenuIcon from "../icons/menu.svg"
import Model from "../model/main.js"

import Modals from "../modals/modals.js"
import SpinnerDialog from "../modals/dialogs/spinnerDialog.js"
import NotificationDialog from "../modals/dialogs/notificationDialog.js"

import Navigation from "./navigation/navigation.js"
import TitlePage from "./pages/title/title.js"
import AdminPage from "./pages/admin/admin.js"

export default class Application extends Component {
	protected static componentName = "Dashboard";
	protected static template = View;

	private modals: Modals = new Modals;
	private navExpanded: boolean = false;

	mounted () {
		super.mounted();

		this.slots.modals.push(this.modals);

		this.state.on("page", this.verify.bind(this));

		this.refs.navButton.src = MenuIcon;
		this.refs.navButton.onclick = this.toggleNav.bind(this);
		this.refs.navCurtain.onclick = this.toggleNav.bind(this);
		this.refs.nav.style.transition = "left 0.3s";
		this.refs.navCurtain.style.transition = "background 0.3s";
		const navigation = new Navigation({})
		navigation.on("hide", this.toggleNav.bind(this));
		this.slots.navigation.push(navigation);
		this.refs.logoutButton.onclick = this.logout.bind(this);

		this.verify();
	}

	async verify () {
		const spinner = new SpinnerDialog({});
		this.modals.showDialog(spinner);

		const result = await Model.getPipe("api.user.verify").run();

		spinner.emit("close");

		if (result.error) {
			const notification = new NotificationDialog({
				message: result.details,
				buttonValue: "To authorization",
				callback: () => { Model.getPipe("router").run("auth"); }
			});

			this.modals.showDialog(notification);
		} else {
			Model.getPipe("settings.username").data = result.userInfo.login;
			Model.getPipe("settings.isAdmin").data = result.userInfo.is_admin;

			if (!Model.getPipe("modals")) {
				const modalsPipe = new Pipe();
				Model.addPipe("modals", modalsPipe);
				const createSpinnerPipe = new SyncFunctionPipe<undefined, Component>(this.createSpinner.bind(this));
				const createNotificationPipe = new SyncFunctionPipe<{ message: string; buttonValue: string; callback?: Function; }, Component>(this.createNotification.bind(this));
				const showDialogPipe = new SyncFunctionPipe<Component, number>(this.modals.showDialog.bind(this.modals));
				const closeDialogPipe = new SyncFunctionPipe<number, undefined>(this.modals.closeDialog.bind(this.modals));
				modalsPipe.addPipe("createSpinner", createSpinnerPipe);
				modalsPipe.addPipe("createNotification", createNotificationPipe);
				modalsPipe.addPipe("showDialog", showDialogPipe);
				modalsPipe.addPipe("closeDialog", closeDialogPipe);
			}

			this.state.update({
				"headerText": `Hello, ${ Model.getPipe("settings.username").data }`
			});

			this.setPage(this.state.getProp("page"), this.state.getProp("id"));
		}
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
			case "admin":
				this.slots.content.push(new AdminPage({}));
				break;
		}
	}

	async logout () {
		await Model.getPipe("api.user.logout").run();

		Model.getPipe("router").run("auth");
	}

	private createSpinner () {
		return new SpinnerDialog({});
	}

	private createNotification (input: { message: string; buttonValue: string; callback?: Function; }) {
		return new NotificationDialog({
			message: input.message,
			buttonValue: input.buttonValue,
			callback: input.callback
		});
	}
}