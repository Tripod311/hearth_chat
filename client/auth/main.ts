import { Component } from "@tripod311/splash"
import View from "./main.html?raw"

import Model from "../model/main.js"

export default class Auth extends Component {
	protected static componentName = "AuthForm";
	protected static template = View;

	mounted () {
		super.mounted();

		this.refs.button.onclick = this.handleSubmit.bind(this);
	}

	handleSubmit () {
		
	}
}