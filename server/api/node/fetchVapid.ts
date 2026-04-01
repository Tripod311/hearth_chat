import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"
import VapidKeys from "../../vapidKeys.js"

export default function fetchVapid (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		ctx.status(200).json({error: false, data: VapidKeys.publicKey});
	});
}