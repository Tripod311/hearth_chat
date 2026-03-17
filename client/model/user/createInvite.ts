import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	invite?: string;
}

const CreateInviteRequest = new AsyncFunctionPipe<undefined, Output>(async () => {
	try {
		const response = await fetch(window.location.origin + "/api/createInvite", {
			method: "POST"
		});

		const data = await response.json();

		if (data.error) throw new Error(data.details);

		return {
			error: false,
			invite: data.data.invite
		}
	} catch (err: any) {
		return {
			error: true,
			details: err.toString()
		}
	}
});

export default CreateInviteRequest