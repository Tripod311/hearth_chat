import { Component, TemplateCache } from "@tripod311/splash"
import View from "./refs.html?raw"
import Ref from "./ref.html?raw"

TemplateCache.registerDrop("singleRef", Ref);

interface RefDescription {
	description?: string;
	title: string;
	link: string;
}

export default class RefsBlock extends Component {
	protected static componentName = "RefsBlock";
	protected static template = View;

	mounted () {
		super.mounted();

		const desc = this.state.getProp("data") as RefDescription[];

		for (const d of desc) {
			const drop = TemplateCache.createDrop("singleRef", d);
			drop.refs.wrapper.onclick = this.followRef.bind(this);

			this.slots.content.push(Component.generic({}, drop.node));
		}
	}

	followRef (link: string) {

	}
}