import { Pump, Pipe, StoragePipe } from "@tripod311/pump"

export default function addSettings (model: Pump) {
	const settingsRoot = new Pipe();

	model.addPipe("settings", settingsRoot);
	const isAdmin = new StoragePipe<boolean>();
	settingsRoot.addPipe("isAdmin", isAdmin);
	isAdmin.data = false;
	const username = new StoragePipe<string>();
	settingsRoot.addPipe("username", username);
	const vapid_key = new StoragePipe<string>();
	settingsRoot.addPipe("vapid_key", vapid_key);
}