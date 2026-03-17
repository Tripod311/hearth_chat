import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	filter: string;
	offset: number;
	limit: number;
}

interface Output {
	error: boolean;
	details?: string;
	data: { login: string; is_admin: number; is_bot: number; last_login: number; };
}

const GetUsersRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(window.location.origin + "/api/getUsers", {
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

export default GetUsersRequest