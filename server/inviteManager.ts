import crypto from "crypto"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

export default class InviteManager extends Node {
	private invites: Set<string> = new Set();

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("createInvite", this.createInvite.bind(this));
		this.setListener("acceptInvite", this.acceptInvite.bind(this));
	}

	createInvite (event: Event) {
		const rand = crypto.randomBytes(16).toString("hex");

		this.invites.add(rand);

		event.response({
			command: "createInviteResponse",
			data: {
				invite: rand
			}
		});
	}

	acceptInvite (event: Event) {
		const invite = event.data.data.invite;

		if (this.invites.has(invite)) {
			const dbAddr = this.address!.parent.data;
			dbAddr.push("db");

			this.chain(dbAddr, {
				command: "addUser",
				data: {
					login: event.data.data.login,
					password: event.data.data.password
				}
			}, (response: Event) => {
				if (response.data.error) {
					event.response({
						command: "acceptInviteResponse",
						error: true,
						details: response.data.details
					});
				} else {
					this.invites.delete(invite);

					event.response({
						command: "acceptInviteResponse",
						error: false
					});
				}
			})
		} else {
			event.response({
				command: "acceptInviteResponse",
				error: true,
				details: `Invite not found`
			});
		}
	}
}