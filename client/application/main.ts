import { Pipe, SyncFunctionPipe } from "@tripod311/pump"
import { Component } from "@tripod311/splash"
import View from "./main.html?raw"

import Model from "../model/main.js"
import MenuIcon from "../icons/menu.svg"
import BellIcon from "../icons/bell-ringing.svg"
import BellCrossIcon from "../icons/bell-cross.svg"
import LogoutIcon from "../icons/logout.svg"

import Modals from "../modals/modals.js"
import SpinnerDialog from "../modals/dialogs/spinnerDialog.js"
import NotificationDialog from "../modals/dialogs/notificationDialog.js"
import PromptDialog from "../modals/dialogs/promptDialog.js"

import Navigation from "./navigation/navigation.js"
import TitlePage from "./pages/title/title.js"
import AdminPage from "./pages/admin/admin.js"
import AccountPage from "./pages/account/account.js"
import ChatPage from "./pages/chat/chat.js"
import TopicsPage from "./pages/topics/topics.js"
import RelatedPage from "./pages/related/related.js"

import { initPush, getPushStatus } from "./push.js"

export default class Application extends Component {
	protected static componentName = "Dashboard";
	protected static template = View;

	private modals: Modals = new Modals({});
	private navExpanded: boolean = false;
	private currentPage: string = "";

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

		this.refs.logoutButton.src = LogoutIcon;
		this.refs.logoutButton.onclick = this.logout.bind(this);

		this.setNotificationIcon();

		this.refs.notificationButton.onclick = this.toggleSubscription.bind(this);

		this.attachModals();

		this.verify();
	}

	attachModals () {
		if (Model.getPipe("modals")) Model.removePipe("modals");

		const modalsPipe = new Pipe();
		Model.addPipe("modals", modalsPipe);
		const createSpinnerPipe = new SyncFunctionPipe<undefined, Component>(this.createSpinner.bind(this));
		const createNotificationPipe = new SyncFunctionPipe<{ message: string; buttonValue: string; callback?: Function; }, Component>(this.createNotification.bind(this));
		const createPromptPipe = new SyncFunctionPipe<{ message: string; callback?: Function; }, Component>(this.createPrompt.bind(this));
		const showDialogPipe = new SyncFunctionPipe<Component, number>(this.modals.showDialog.bind(this.modals));
		const closeDialogPipe = new SyncFunctionPipe<number, undefined>(this.modals.closeDialog.bind(this.modals));
		modalsPipe.addPipe("createSpinner", createSpinnerPipe);
		modalsPipe.addPipe("createNotification", createNotificationPipe);
		modalsPipe.addPipe("createPrompt", createPromptPipe);
		modalsPipe.addPipe("showDialog", showDialogPipe);
		modalsPipe.addPipe("closeDialog", closeDialogPipe);
	}

	async verify () {
		const spinner = new SpinnerDialog({});
		this.modals.showDialog(spinner);

		const result = await Model.getPipe("api.user.verify").run();

		spinner.emit("close");

		if (result.error) {
			Model.getPipe("router").run("auth");
		} else {
			Model.getPipe("settings.username").data = result.userInfo.login;
			Model.getPipe("settings.isAdmin").data = result.userInfo.is_admin;

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
		if (this.currentPage !== type) {
			this.currentPage = type;

			this.slots.content.clear();

			switch (type) {
				case "title":
					this.slots.content.push(new TitlePage({}));
					break;
				case "admin":
					this.slots.content.push(new AdminPage({}));
					break;
				case "account":
					this.slots.content.push(new AccountPage({}));
					break;
				case "topic":
					this.slots.content.push(new ChatPage({ id: this.state.getProp("topicId") }));
					break;
				case "topics":
					this.slots.content.push(new TopicsPage({}));
					break;
				case "related":
					this.slots.content.push(new RelatedPage({}));
			}
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

	private createPrompt (input: { message: string; callback?: Function; }) {
		return new PromptDialog({
			message: input.message,
			callback: input.callback
		});
	}

	async setNotificationIcon () {
		const result = await getPushStatus();

		if (!result.supported) {
			this.notificationButton.style.display = "none";
		} else {
			if (result.subscribed) {
				this.notificationButton.src = BellCrossIcon;
			} else {
				this.notificationButton.src = BellIcon;
			}
		}
	}

	async toggleSubscription () {
		const current = await getPushStatus();

		if (!current.supported) return;

		if (current.subscribed) {
			const spinner = new SpinnerDialog({});
			this.modals.showDialog(spinner);

			const result = await Model.getPipe("api.push.delete").run({
				endpoint: subscription.endpoint
			});

			spinner.emit("close");

			if (result.error) {
				const notification = Model.getPipe("modals.createNotification").run({ message: result.details, buttonValue: "Close" });
				Model.getPipe("modals.showDialog").run(notification);
			} else {
				const notification = Model.getPipe("modals.createNotification").run({ message: "Success", buttonValue: "Close" });
				Model.getPipe("modals.showDialog").run(notification);
				this.setNotificationIcon();
			}

			await current.subscription.unsubscribe();
		} else {
			const subscription = await initPush();

			const spinner = new SpinnerDialog({});
			this.modals.showDialog(spinner);

			const result = await Model.getPipe("api.push.add").run({
				endpoint: subscription.endpoint,
				p256dh: subscription.keys.p256dh,
				auth: subscription.keys.auth
			});

			spinner.emit("close");

			if (result.error) {
				const notification = Model.getPipe("modals.createNotification").run({ message: result.details, buttonValue: "Close" });
				Model.getPipe("modals.showDialog").run(notification);
			} else {
				const notification = Model.getPipe("modals.createNotification").run({ message: "Success", buttonValue: "Close" });
				Model.getPipe("modals.showDialog").run(notification);
				this.setNotificationIcon();
			}
		}
	}
}