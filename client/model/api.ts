import { Pump, Pipe } from "@tripod311/pump"

import LoginRequest from "./user/login.js"
import LogoutRequest from "./user/logout.js"
import VerifyRequest from "./user/verify.js"

import TitlePageRequest from "./nodeInfo/titlePage.js"
import GetNodeSettingsRequest from "./nodeInfo/getNodeSettings.js"
import SetNodeSettingsRequest from "./nodeInfo/setNodeSettings.js"

export default function addAPI (model: Pump) {
	const root = new Pipe();
	model.addPipe("api", root);

	const userRoot = new Pipe();
	root.addPipe("user", userRoot);
	userRoot.addPipe("login", LoginRequest);
	userRoot.addPipe("logout", LogoutRequest);
	userRoot.addPipe("verify", VerifyRequest);

	const nodeInfoRoot = new Pipe();
	root.addPipe("nodeInfo", nodeInfoRoot);
	nodeInfoRoot.addPipe("titlePage", TitlePageRequest);
	nodeInfoRoot.addPipe("getNodeSettings", GetNodeSettingsRequest);
	nodeInfoRoot.addPipe("setNodeSettings", SetNodeSettingsRequest);
}