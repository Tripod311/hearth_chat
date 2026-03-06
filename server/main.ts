import { Dispatcher, Address } from "@tripod311/dispatch"
import Root from "./root.js"

const dispatcher = new Dispatcher();
const root = new Root();

process.on("SIGINT", () => {
	dispatcher.removeRoot();
});

process.on("SIGTERM", () => {
	dispatcher.removeRoot();
});

dispatcher.setRoot(root, new Address(["root"]));