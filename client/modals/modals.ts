import { Component } from "@tripod311/splash"
import View from "./modals.html?raw"

export default class Modals extends Component {
	protected static componentName: string = "ModalManager";
	protected static template: string = View;

	private counter: number = 0;
	private dialogs: Record<number, Component> = {};
	private frame: ReturnType<typeof requestAnimationFrame>;

	constructor (options: Record<string, any>) {
		super (options);
	}

	showDialog (dialog: Component): number {
		const id = this.counter++;
		this.dialogs[id] = dialog;

		this.refs["curtain"].remove();
		this.refs["container"].appendChild(this.refs["curtain"]);
		this.refs["container"].appendChild(dialog.DOMNode);

		dialog.mounted();
		dialog.on("close", this.closeDialog.bind(this, id));
		dialog.on("subdialog", this.subdialog.bind(this, id));

		this.setCurtain();

		return id;
	}

	closeDialog (id: number) {
		const dialog = this.dialogs[id];

		if (dialog !== undefined) {
			dialog.unmounted();
			dialog.DOMNode.remove();
		}

		delete this.dialogs[id];

		this.setCurtain();
	}

	subdialog (id: number, dialog: Component): number {
		const parentDialog = this.dialogs[id] as Component;

		// bring parent to front
		parentDialog.DOMNode.remove();
		this.refs["container"].appendChild(parentDialog.DOMNode);

		return this.showDialog(dialog);
	}

	unmounted () {
		for (const id in this.dialogs) {
			this.dialogs[id].unmounted();
		}

		super.unmounted();
	}

	setCurtain () {
		cancelAnimationFrame(this.frame);

		if (Object.keys(this.dialogs).length !== 0) {
			this.refs["curtain"].style.opacity = 1;

			this.refs["curtain"].remove();
			const children = this.refs["container"].children;
			this.refs["container"].insertBefore(this.refs["curtain"], children[children.length - 1]);
		} else {
			this.refs["curtain"].style.opacity = 0;
		}
	}
}