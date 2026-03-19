import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	id: number;
	title: string;
	description: string;
	guest_access: boolean;
	author_write_only: boolean;
	password?: string;
}

interface Output {
	error: boolean;
	details?: string;
}

const UpdateTopicRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(window.location.origin + "/api/updateTopic", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(input)
		});

		const data = await response.json();

		if (data.error) throw new Error(data.details);

		return {
			error: false
		}
	} catch (err: any) {
		return {
			error: true,
			details: err.toString()
		}
	}
});

export default UpdateTopicRequest