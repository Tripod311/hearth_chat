import path from "path"
import { Node, Dispatcher, Address, Event, Log } from "@tripod311/dispatch"
import { Currents, ParseCookies, Cors, SecurityHeaders, ServeStatic, JsonBody, StreamingMultipartBody, Context } from "@tripod311/currents"
import type { CorsOptions, CurrentsOptions, RouteHandler } from "@tripod311/currents"

export default class API extends Node {
	private instance: Currents;
	private baseChain: RouteHandler[];
	private port: number;

	constructor (port: number, certificates: ApplicationConfig["http_certificates"]) {
		super();

		this.port = port;

		this.instance = Currents.fromOptions({
			certificates: certificates
		});

		this.baseChain = [
			SecurityHeaders({
				transportSecurity: {
					maxAge: 31536000,
					includeSubDomains: true
				},
				contentTypeOptions: true,
				xFrameOptions: 'DENY'
			}),
			ParseCookies()
		]

		// add routes

		this.instance.get('/*', this.baseChain
			.concat([
				ServeStatic({
					basePath: "/",
					rootDir: path.join(process.cwd(), 'client_dist'),
					cacheControl: ["public", "max-age=0"],
					fallback: "index.html"
				})
			])
		);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.instance.server.listen(this.port, () => {
			Log.success("Node listening on " + this.port, 0);
		})
	}

	detach () {
		this.instance.server.close();

		super.detach();
	}
}