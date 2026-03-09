import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
}

const LogoutRequest = new AsyncFunctionPipe<undefined, undefined>(async () => {
	try {
		const response = await fetch(window.location.origin + "/api/logout", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			}
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

export default LogoutRequest