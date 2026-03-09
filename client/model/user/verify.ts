import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	userInfo: { name: string; is_admin: boolean; };
}

const VerifyRequest = new AsyncFunctionPipe<undefined, Output>(async () => {
	try {
		const response = await fetch(window.location.origin + "/api/verify", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			}
		});

		const data = await response.json();

		if (data.error) throw new Error(data.details);

		return {
			error: false,
			userInfo: data.userInfo
		}
	} catch (err: any) {
		return {
			error: true,
			details: err.toString()
		}
	}
});

export default VerifyRequest