import { Pump, Pipe, StoragePipe, SyncFunctionPipe } from "@tripod311/pump"
import DefaultLocale from "./en.json?raw"

const locales: Record<string, Record<string, string>> = {};

export default async function addLocalization (model: Pump) {
	locales["en"] = JSON.parse(DefaultLocale);

	const localeRoot = new Pipe();
	model.addPipe("locale", localeRoot);
	
	const currentLocale = new StoragePipe<string>();
	localeRoot.addPipe("current", currentLocale);
	currentLocale.on(() => {
		localStorage.setItem("locale", currentLocale.data);
	});

	const storedLocale = localStorage.getItem("locale");
	if (!storedLocale) {
		currentLocale.data = window.navigator.language.slice(0, 2).toLowerCase();
	} else {
		currentLocale.data = storedLocale;
	}

	const available = new StoragePipe<string[]>();
	localeRoot.addPipe("available", available);

	const getLocalized = new SyncFunctionPipe<string, string>((path: string) => {
		const current = currentLocale.data;

		let root = locales[current] || locales["en"];
		const sp = path.split('.');
		let index = 0;

		while (index < sp.length) {
			if (root[sp[index]]) root = root[sp[index]];
			else return path;
			index++;
		}

		return root as string;
	});
	localeRoot.addPipe("getLocalized", getLocalized);

	try {
		const response = await fetch("/locales");

		const data = await response.json();

		if (data.error) throw new Error(data.details);

		for (const name in data.data) {
			locales[name] = data.data[name];
		}
	} catch (err: any) {
		console.error(`Can't fetch locales: ${err.toString()}`);
	}

	available.data = Object.keys(locales);
}