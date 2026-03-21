import EventEmitter from "events"

export default abstract class Actor extends EventEmitter {
	public authorized: boolean = false;
	public display_name: string;
	public node_id: string;
	public node_user_id: number;

	constructor (display_name: string, node_id: string, node_user_id: number) {
		super();

		this.display_name = display_name;
		this.node_id = node_id;
		this.node_user_id = node_user_id;
	}

	abstract proxy (data: string): void;
}