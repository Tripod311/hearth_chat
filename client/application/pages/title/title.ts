import { Component, TemplateCache } from "@tripod311/splash"
import View from "./title.html?raw"

import Model from "../../../model/main.js"

import TextBlock from "./blocks/text.html?raw"
import ImageBlock from "./blocks/image.html?raw"
import DividerBlock from "./blocks/divider.html?raw"
import CustomBlock from "./blocks/custom.html?raw"

TemplateCache.registerDrop("titleTextBlock", TextBlock);
TemplateCache.registerDrop("titleImageBlock", ImageBlock);
TemplateCache.registerDrop("titleDividerBlock", DividerBlock);
TemplateCache.registerDrop("titleCustomBlock", CustomBlock);

import RefsBlock from "./blocks/refs.js"

interface BlockDescription {
	type: 'text' | 'image' | 'refs' | 'divider' | 'custom';
	data: any;
}

export default class TitlePage extends Component {
	protected static componentName = "TitlePage";
	protected static template = View;

	mounted () {
		super.mounted();

		// fetch title page content from server

		// const titlePageContent: BlockDescription[] = [
		// 	{
		// 		type: "text",
		// 		data: {
		// 			title: "HearthChat node",
		// 			text: "Example of HearthChat node"
		// 		}
		// 	},
		// 	{
		// 		type: "image",
		// 		data: {
		// 			src: "",
		// 			alt: "",
		// 			caption: "Some image"
		// 		}
		// 	},
		// 	{
		// 		type: "refs",
		// 		data: [
		// 			{
		// 				link: "",
		// 				title: "Chatterbox",
		// 				description: "Introduce yourself"
		// 			},
		// 			{
		// 				link: "",
		// 				title: "Max'x node",
		// 				description: "Meet my brother"
		// 			}
		// 		]
		// 	},
		// 	{
		// 		type: "divider"
		// 	},
		// 	{
		// 		type: "custom",
		// 		data: {
		// 			content: `<span class="text-4xl">DICK</div>`
		// 		}
		// 	}
		// ];

		this.renderPage();
	}

	async renderPage () {
		const spinner = Model.getPipe("modals.createSpinner").run();
		Model.getPipe("modals.showDialog").run(spinner);

		const response = await Model.getPipe("api.nodeInfo.titlePage").run();

		spinner.emit("close");

		if (response.error) {
			const notification = Model.getPipe("modals.createNotification").run({
				message: response.details,
				buttonValue: "Ok"
			});
			Model.getPipe("modals.showDialog").run(notification);
		} else {
			for (const block of response.data) {
				this.slots.blocks.push(TitlePage.createBlock(block as BlockDescription));
			}
		}
	}

	private static createBlock (desc: BlockDescription): Component {
		let drop: ReturnType<typeof TemplateCache.createDrop>;

		switch (desc.type) {
			case "text":
				drop = TemplateCache.createDrop("titleTextBlock", desc.data);
				return Component.generic({}, drop.node);
			case "image":
				drop = TemplateCache.createDrop("titleImageBlock", desc.data);
				return Component.generic({}, drop.node);
			case "divider":
				drop = TemplateCache.createDrop("titleDividerBlock", desc.data);
				return Component.generic({}, drop.node);
			case "custom":
				drop = TemplateCache.createDrop("titleCustomBlock", desc.data);
				return Component.generic({}, drop.node);
			case "refs":
				return new RefsBlock({ data: desc.data });
		}
	}
}