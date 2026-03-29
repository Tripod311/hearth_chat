import { AsyncFunctionPipe } from "@tripod311/pump"

interface Input {
	name: string;
	description: string;
	title_page: string;
	http_port: number;
	gate_port: number;
	ice_candidates: string;
	announced_ip: string | null;
}

interface Output {
	error: boolean;
	details?: string;
}

const SetNodeSettingsRequest = new AsyncFunctionPipe<Input, Output>(async (input: Input) => {
	try {
		const response = await fetch(window.location.origin + "/api/nodeSettings", {
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

export default SetNodeSettingsRequest