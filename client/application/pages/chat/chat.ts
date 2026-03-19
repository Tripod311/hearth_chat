import { Component } from "@tripod311/splash"
import View from "./chat.html?raw"

export default class Chat extends Component {
	protected static componentName = "Chat";
	protected static template = View;
}