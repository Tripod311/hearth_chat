import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	from: string;
	to: string;
}

interface Output {
	error: boolean;
	details?: string;
	selfId: boolean;
}

const GoToRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(`${window.location.origin}/api/goTo`, {
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
			selfId: data.selfId
		}
	} catch (err: any) {
		return {
			error: true,
			details: err.toString()
		}
	}
});

export default GoToRequest