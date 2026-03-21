import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	topic_node: string;
	topic_id: number;
}

interface Output {
	error: boolean;
	details?: string;
	data: string;
}

const WSRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(window.location.origin + "/api/requestWS", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(input)
		});

		const data = await response.json();

		if (data.error) throw new Error(data.details);

		return {
			error: false,
			data: data.data
		}
	} catch (err: any) {
		return {
			error: true,
			details: err.toString()
		}
	}
});

export default WSRequest