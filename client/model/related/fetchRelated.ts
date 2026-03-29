import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	data: any;
}

const FetchRelatedRequest = new AsyncFunctionPipe<string, Output>(async (nodeId: string) => {
	try {
		const response = await fetch(`${window.location.origin}/api/${nodeId}/related`, {
			method: "GET"
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

export default FetchRelatedRequest