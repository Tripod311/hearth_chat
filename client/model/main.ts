import { Pump } from "@tripod311/pump"
import addSettings from "./settings.js"
import addAPI from "./api.js"
import addLocale from "./localization/setup.js"

const Model = new Pump();

addSettings(Model);
addLocale(Model);
addAPI(Model);

export default Model;