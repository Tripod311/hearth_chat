import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
}

const ForgetRelatedRequest = new AsyncFunctionPipe<string, Output>(async (uuid: string) => {
	try {
		const response = await fetch(window.location.origin + "/api/forgetRelated", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ uuid })
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

export default ForgetRelatedRequest