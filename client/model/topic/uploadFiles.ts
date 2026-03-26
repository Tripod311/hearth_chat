import { AsyncFunctionPipe } from "@tripod311/pump"

interface Output {
	error: boolean;
	details?: string;
	data?: string[];
}

const UploadFilesRequest = new AsyncFunctionPipe<File[], Output>(async (input: File[]) => {
	try {
		const formData = new FormData();

		for (let index=0; index<input.length; index++) {
			formData.append(index.toString(), input[index], input[index].name);
		}

		const response = await fetch(window.location.origin + "/api/uploadFiles", {
			method: "POST",
			body: formData
		});

		const data = await response.json();

		if (data.error) throw new Error(data.details);

		return {
			error: false,
			data: data
		}
	} catch (err: any) {
		return {
			error: true,
			details: err.toString()
		}
	}
});

export default UploadFilesRequest