import FS from "fs"
import webpush from "web-push"

let keys: { mail: string; publicKey: string; privateKey: string; } = { mail: "", publicKey: "", privateKey: "" };

if (!FS.existsSync('./vapid.json')) {
	const newKeys = webpush.generateVAPIDKeys();

	keys = {
		mail: process.env.VAPID_MAIL || 'mailto:admin@localhost',
		publicKey: newKeys.publicKey,
		privateKey: newKeys.privateKey
	};
	FS.writeFileSync('./vapid.json', JSON.stringify(keys));
} else {
	keys = JSON.parse(FS.readFileSync("./vapid.json", "utf-8"));
}

webpush.setVapidDetails(
	keys.mail,
	keys.publicKey,
	keys.privateKey
);

export default keys