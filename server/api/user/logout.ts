import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default async function logout (this: Node, ctx: Context) {
	SetCookie(ctx, "hearthchat_token", "", {
		httpOnly: true,
		sameSite: "Strict",
		maxAge: 0
	});

	ctx.status(200).json({ error: false });
}