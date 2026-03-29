import { Context, SetCookie } from "@tripod311/currents"
import { Node, Event } from "@tripod311/dispatch"

export default function sendHandshake (this: Node, ctx: Context): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!ctx.locals.userInfo.is_admin) {
			ctx.status(403).json({ error: true, details: "Access forbidden" });
		} else {
			const dbAddress = this.address!.parent.data;
			dbAddress.push("db");

			this.chain(dbAddress, {
				command: "getNodeSettings",
				data: {}
			}, async (response: Event) => {
				if (response.data.error) {
					ctx.status(500).json({ error: true, details: response.data.details });
					return;
				}

				try {
					const data = await fetch(ctx.body.link, {
						method: "POST",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({
							message: ctx.body.message,
							uuid: response.data.data.uuid,
							title: response.data.data.title,
							description: response.data.data.description,
							port: response.data.data.port
						})
					});

					const result = await data.json();

					if (result.error) throw new Error(result.details);

					ctx.status(200).json({ error: false });
				} catch (err: any) {
					ctx.status(500).json({ error: true, details: err.toString() })
				}
			});
		}
	});
}