import { Pump } from "@tripod311/pump"
import addSettings from "./settings.js"
import addAPI from "./api.js"

const Model = new Pump();

addSettings(Model);
addAPI(Model);

export default Model;