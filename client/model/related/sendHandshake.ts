import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
}

const SendHandshakeRequest = new AsyncFunctionPipe<string, Output>(async (link: string) => {
	try {
		const response = await fetch(window.location.origin + "/api/sendHandshake", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ link })
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

export default SendHandshakeRequest