const PUBLIC_VAPID_KEY = 'ТВОЙ_KEY';

function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding)
		.replace(/-/g, '+')
		.replace(/_/g, '/');

	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function initPush() {
	if (!('serviceWorker' in navigator)) return;
	if (!('PushManager' in window)) return;

	const existing = await registration.pushManager.getSubscription();

	if (existing) {
		return existing;
	}

	const registration = await navigator.serviceWorker.register('/sw.js', {
		updateViaCache: 'none'
	});

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return;

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
	});

	await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(subscription)
	});

	return subscription;
}

export async function getPushStatus() {
	if (!('serviceWorker' in navigator)) {
		return { supported: false };
	}

	const permission = Notification.permission;

	const registration = await navigator.serviceWorker.getRegistration();

	if (!registration) {
		return {
			supported: true,
			permission: permission,
			subscribed: false
		};
	}

	const subscription = await registration.pushManager.getSubscription();

	return {
		supported: true,
		permission: permission,
		subscribed: !!subscription,
		subscription: subscription
	};
}