import { Component } from "@tripod311/splash"
import View from "./view.html?raw"

export default class RelatedTab extends Component {
	protected static componentName = "RelatedTab";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.handshake.onclick = this.handshake.bind(this);

		this.fetchNodes();
	}

	async fetchNodes () {
		
	}

	async handshake () {

	}
}