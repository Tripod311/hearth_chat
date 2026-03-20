import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function deleteTopic (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "deleteTopic",
			data: {
				userId: ctx.locals.userInfo.id,
				id: ctx.body.id
			}
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(500).json({ error: true, details: response.data.details });
			} else {
				ctx.status(200).json({ error: false });
			}
		});
	});
}