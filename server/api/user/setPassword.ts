import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function setPassword (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		let login: string;

		if (ctx.locals.userInfo.is_admin && ctx.body.login) {
			login = ctx.body.login;
		} else {
			login = ctx.locals.userInfo.login;
		}

		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "setPassword",
			data: { login: login, password: ctx.body.password }
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(500).json({ error: true, details: response.data.details });
			} else {
				ctx.status(200).json({ error: false, data: response.data.data });
			}
		});
	});
}