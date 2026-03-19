import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	login?: string;
	password: string;
}

interface Output {
	error: boolean;
	details?: string;
}

const SetPasswordRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(window.location.origin + "/api/setPassword", {
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

export default SetPasswordRequest