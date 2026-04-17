import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

import Model from "../../model/main.js"

export default class LocaleSelector extends Component {
	protected static componentName = "LocaleSelector";
	protected static template = View;

	private listener: () => void;

	constructor (options: Record<string, any>) {
		super(options);

		this.listener = this.listChange.bind(this);
	}

	mounted () {
		super.mounted();

		Model.getPipe("locale.available").on(this.listener);

		this.listChange();
	}

	unmounted () {
		Model.getPipe("locale.available").off(this.listener);

		super.unmounted();
	}

	listChange () {
		this.refs.content.innerHTML = "";

		const available = Model.getPipe("locale.available").data || [];

		for (const l of available) {
			const elem = document.createElement("option");
			elem.value = l;
			elem.innerText = l;
			this.refs.content.appendChild(elem);
		}
	}
}