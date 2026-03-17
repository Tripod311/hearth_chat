import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	invite: string;
	login: string;
	password: string;
}

interface Output {
	error: boolean;
	details?: string;
	invite?: string;
}

const AcceptInviteRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(window.location.origin + "/api/acceptInvite", {
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

export default AcceptInviteRequest