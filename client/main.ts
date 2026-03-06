import { Flow } from "@tripod311/flow"
import Application from "./application/main.js"
import Auth from "./auth/main.js"
import { SyncFunctionPipe } from "@tripod311/pump"
import { Component } from "@tripod311/splash"
import Model from "./model/main.js"

const root = document.getElementById("root");
let currentComponent: Component | null = null;
const router = new Flow();

function redirectToTitle () {
	router.navigate("self/title");
}

function renderTitle (params: Record<string,string>) {
	if (!(currentComponent instanceof Application)) {
		if (currentComponent !== null) currentComponent.unmount();

		currentComponent = new Application({
			proxy: params.proxy || "self",
			page: "title"
		});
		currentComponent.mount(root);
	} else {
		currentComponent.update({
			proxy: params.proxy || "self",
			page: "title"
		});
	}
}

function renderAccountInfo (params: Record<string, string>) {
	if (!(currentComponent instanceof Application)) {
		if (currentComponent !== null) currentComponent.unmount();

		currentComponent = new Application({
			proxy: params.proxy || "self",
			page: "accountInfo"
		});
		currentComponent.mount(root);
	} else {
		currentComponent.update({
			proxy: params.proxy || "self",
			page: "accountInfo"
		});
	}
}

function renderTopic (params: Record<string, string>) {
	if (!(currentComponent instanceof Application)) {
		if (currentComponent !== null) currentComponent.unmount();

		currentComponent = new Application({
			proxy: params.proxy || "self",
			page: "topic",
			topicId: params.topicId
		});
		currentComponent.mount(root);
	} else {
		currentComponent.update({
			proxy: params.proxy || "self",
			page: "topic",
			topicId: params.topicId
		});
	}
}

function renderAdmin (params: Record<string, string>) {
	if (!(currentComponent instanceof Application)) {
		if (currentComponent !== null) currentComponent.unmount();

		currentComponent = new Application({
			proxy: params.proxy || "self",
			page: "admin"
		});
		currentComponent.mount(root);
	} else {
		currentComponent.update({
			proxy: params.proxy || "self",
			page: "admin"
		});
	}
}

function renderAuth () {
	if (!(currentComponent instanceof Auth)) {
		if (currentComponent !== null) currentComponent.unmount();

		currentComponent = new Auth({});
		currentComponent.mount(root);
	}
}

function fallback () {
	Model.getPipe("router").run("");
}

router.add("/", redirectToTitle);
router.add("/:proxy/title", renderTitle);
router.add("/:proxy/account", renderAccountInfo);
router.add("/:proxy/topic/:topicId", renderTopic);
router.add("/:proxy/admin", renderAdmin);
router.add("/auth", renderAuth);

router.setFallback(fallback);

const navigatePipe = new SyncFunctionPipe<string, undefined>((path: string) => {
	router.navigate('/' + path);
});
Model.addPipe("router", navigatePipe);

router.init();