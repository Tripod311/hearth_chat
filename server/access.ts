import crypto from "crypto"
import jwt from "jsonwebtoken"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"

const hour4 = 60 * 60 * 4;

interface Payload {
	exp: number;
	payload: any;
}

export default class Access extends Node {
	private static readonly jwt_secret = crypto.randomBytes(32).toString('base64url');

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("generateToken", this.generateToken.bind(this));
		this.setListener("verifyToken", this.verifyToken.bind(this));
	}

	generateToken (event: Event) {
		const token = jwt.sign(
			{ payload: event.data.data },
			Access.jwt_secret,
			{ "expiresIn": "24h" }
		);

		event.response({
			command: "generateTokenResponse",
			error: false,
			data: { token: token }
		});
	}

	verifyToken (event: Event) {
		try {
			const decoded = jwt.verify(event.data.data.token, Access.jwt_secret) as Payload;

			const now = Math.floor(Date.now() / 1000);
			const ttl = decoded.exp - now;

			if (ttl < hour4) {
				const refreshToken = jwt.sign(
					{ payload: decoded.payload },
					Access.jwt_secret,
					{ "expiresIn": "24h" }
				);

				event.response({
					command: "verifyTokenResponse",
					error: false,
					data: {
						refreshToken: refreshToken,
						payload: decoded.payload
					}
				});
			} else {
				event.response({
					command: "verifyTokenResponse",
					error: false,
					data: {
						payload: decoded.payload
					}
				});
			}
		} catch (err: any) {
			event.response({
				command: "verifyTokenResponse",
				error: true,
				details: err.toString()
			});
		}
	}
}