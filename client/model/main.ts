import { Pump } from "@tripod311/pump"
import addSettings from "./settings.js"

const Model = new Pump();

addSettings(Model);

export default Model;