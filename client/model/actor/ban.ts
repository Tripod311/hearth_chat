import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
}

const BanRequest = new AsyncFunctionPipe<number, Output>(async (id: number) => {
	try {
		const response = await fetch(window.location.origin + "/api/banActor", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ id })
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

export default BanRequest