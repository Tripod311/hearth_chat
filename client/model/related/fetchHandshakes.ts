import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	data: any;
}

const FetchHandshakesRequest = new AsyncFunctionPipe<undefined, Output>(async () => {
	try {
		const response = await fetch(window.location.origin + "/api/handshakes", {
			method: "GET"
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

export default FetchHandshakesRequest