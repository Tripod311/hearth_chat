import FS from "fs"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

const HYST = 1000 * 60 * 5;

export default class UploadsTracker extends Node {
	private unassigned: string[] = [];
	private timeout?: ReturnType<typeof setTimeout>;

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("remember", this.remember.bind(this));
	}

	forceCheck () {
		clearTimeout(this.timeout);

		return this.checkAssigned();
	}

	remember (event: Event) {
		clearTimeout(this.timeout);

		this.unassigned = this.unassigned.concat(event.data.data.files);

		this.timeout = setTimeout(this.checkAssigned.bind(this), HYST);
	}

	checkAssigned (): Promise<void> {
		const fList = this.unassigned.slice();
		this.unassigned = [];

		return new Promise((resolve, reject) => {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "checkAssigned",
				data: { files: fList }
			}, (response: Event) => {
				if (response.data.error) {
					Log.error(`UploadsTracker error: ${response.data.details}`, 0);
				} else {
					for (const fName of response.data.data) {
						FS.rmSync(fName);
					}
				}

				resolve();
			})
		});
	}
}