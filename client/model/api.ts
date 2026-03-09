import { Pump, Pipe } from "@tripod311/pump"

import LoginRequest from "./user/login.js"
import LogoutRequest from "./user/logout.js"
import VerifyRequest from "./user/verify.js"

export default function addAPI (model: Pump) {
	const root = new Pipe();
	model.addPipe("api", root);

	const userRoot = new Pipe();
	root.addPipe("user", userRoot);
	userRoot.addPipe("login", LoginRequest);
	userRoot.addPipe("logout", LogoutRequest);
	userRoot.addPipe("verify", VerifyRequest);
}