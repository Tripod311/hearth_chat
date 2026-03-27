import { Component } from "@tripod311/splash"
import View from "./authorBlock.html?raw"

import TopicBlock from "./topicBlock.js"

export default class AuthorBlock extends Component {
	protected static componentName = "TopicAuthorBlock";
	protected static template = View;

	mounted () {
		super.mounted();
		
		const topics = this.state.getProp("topics");

		for (const topic of topics) {
			this.slots.topics.push(new TopicBlock(topic));
		}
	}
}