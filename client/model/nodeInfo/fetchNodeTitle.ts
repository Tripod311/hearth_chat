import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	data?: string;
}

const NodeTitleRequest = new AsyncFunctionPipe<string, Output>(async (uuid: string) => {
	try {
		const response = await fetch(window.location.origin + "/api/nodeTitle", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				uuid
			})
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

export default NodeTitleRequest