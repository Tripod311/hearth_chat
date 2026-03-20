import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function acceptInvite (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const inviteAddr = this.address!.parent.data;
		inviteAddr.push("invites");

		this.chain(inviteAddr, {
			command: "acceptInvite",
			data: ctx.body
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(500).json({ error: true, details: response.data.details });
			} else {
				ctx.status(200).json({ error: false });
			}
		});
	});
}