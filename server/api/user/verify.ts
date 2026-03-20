import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function verify (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		const token = ctx.cookies["hearthchat_token"];

		const accessAddress = this.address!.parent.data;
		accessAddress.push("access");

		this.chain(accessAddress, {
			command: "verifyToken",
			data: {
				token: token
			}
		}, (response: Event) => {
			if (response.data.error) {
				ctx.status(403).json({ error: true, details: "Access forbidden" });
			} else {
				if (response.data.data.refreshToken) {
					SetCookie(ctx, "hearthchat_token", response.data.data.refreshToken, {
						httpOnly: true,
						sameSite: "Strict",
						maxAge: 60 * 60 * 24
					});
				}

				ctx.locals.userInfo = response.data.data.payload;
			}

			resolve();
		})
	});
}