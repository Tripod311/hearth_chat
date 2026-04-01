import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function login (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const dbAddress = this.address!.parent.data;
		dbAddress.push("db");

		this.chain(dbAddress, {
			command: "authUser",
			data: ctx.body
		}, (dbResponse: Event) => {
			if (dbResponse.data.error) {
				ctx.status(403).json({ error: true, details: dbResponse.data.details });

				resolve();
			} else {
				const accessAddress = this.address!.parent.data;
				accessAddress.push("access");

				this.chain(accessAddress, {
					command: "generateToken",
					data: dbResponse.data.data
				}, (accessResponse: Event) => {
					if (accessResponse.data.error) {
						ctx.status(500).json({ error: true, details: "Internal error: " + accessResponse.data.details });
					} else {
						SetCookie(ctx, "hearthchat_token", accessResponse.data.data.token, {
							httpOnly: true,
							sameSite: "Strict",
							maxAge: 60 * 60 * 24,
							path: "/"
						});
						ctx.status(200).json({
							error: false,
							data: {
								id: dbResponse.data.data.id,
								login: ctx.body.login,
								is_admin: dbResponse.data.data.is_admin,
								is_bot: dbResponse.data.data.is_bot
							}});
					}

					resolve();
				})
			}
		});
	});
}