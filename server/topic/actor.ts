import EventEmitter from "events"

export default abstract class Actor extends EventEmitter {
	public authorized: boolean = false;
	public is_admin: boolean;
	public is_bot: boolean;
	public display_name: string;
	public id: number;
	public node_id: string | null;
	public node_user_id: number;

	constructor (is_admin: boolean, is_bot: boolean, display_name: string, id: number, node_id: string | null, node_user_id: number) {
		super();

		this.is_admin = is_admin;
		this.is_bot = is_bot;
		this.display_name = display_name;
		this.id = id;
		this.node_id = node_id;
		this.node_user_id = node_user_id;
	}

	abstract kill (): void;

	abstract proxy (data: string): void;
}