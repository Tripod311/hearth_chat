import { Component } from "@tripod311/splash"
import View from "./spinnerDialog.html?raw"

export default class SpinnerDialog extends Component {
	protected static componentName = "SpinnerDialog";
	protected static template = View;

	transitionReady () {
		this.refs["container"].style.opacity = 1;
		this.refs["container"].style.top = 0;
	}
}