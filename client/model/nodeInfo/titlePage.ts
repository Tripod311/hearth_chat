import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	data: any[];
}

const TitlePageRequest = new AsyncFunctionPipe<undefined, Output>(async () => {
	try {
		const nodeId = window.location.pathname.split('/')[1];

		const response = await fetch(window.location.origin + "/api/titlePage", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				nodeId: nodeId
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

export default TitlePageRequest