import { Component, TemplateCache } from "@tripod311/splash"
import View from "./refs.html?raw"
import Ref from "./ref.html?raw"

import Model from "../../../../model/main.js"

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
			drop.refs.wrapper.onclick = this.followRef.bind(this, d.link);

			this.slots.content.push(Component.generic({}, drop.node));
		}
	}

	followRef (link: string) {
		if (link.startsWith('/')) {
			Model.getPipe('router').run(link.slice(1));
		} else {
			window.open(link, '_blank', 'noopener,noreferrer');
		}
	}
}