import EventEmitter from "events"

export default abstract class Proxy extends EventEmitter {
	public id: number;
	public topic_id: number;
	public display_name: string;
	public node_user_id: number;
	protected is_ready: boolean = false;

	constructor (id: number, topic_id: number, node_user_id: number, display_name: string) {
		super();

		this.id = id;
		this.topic_id = topic_id;
		this.display_name = display_name;
		this.node_user_id = node_user_id;
	}

	onDestroyed () {
		this.emit("destroy");
	}

	abstract ready (): void;
	abstract kill (): void;
	abstract forward (data: any): void;
	abstract receive (data: any): void;
}