import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
}

const AcceptHandshakeRequest = new AsyncFunctionPipe<string, Output>(async (id: string) => {
	try {
		const nodeId = window.location.pathname.split('/')[1];

		const response = await fetch(window.location.origin + "/api/acceptHandshake", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ id })
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

export default AcceptHandshakeRequest