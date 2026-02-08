import { browser } from '$app/environment';

const PREFS_KEY = 'falcon-dash:preferences';

interface NotificationPrefs {
	notificationsEnabled: boolean;
	notificationSound: boolean;
}

function getPrefs(): NotificationPrefs {
	if (!browser) return { notificationsEnabled: true, notificationSound: true };
	try {
		const stored = localStorage.getItem(PREFS_KEY);
		if (stored) {
			const prefs = JSON.parse(stored);
			return {
				notificationsEnabled: prefs.notificationsEnabled !== false,
				notificationSound: prefs.notificationSound !== false
			};
		}
	} catch {
		// ignore
	}
	return { notificationsEnabled: true, notificationSound: true };
}

/** Request notification permission from the browser */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (!browser || !('Notification' in window)) return 'denied';
	if (Notification.permission === 'granted') return 'granted';
	return Notification.requestPermission();
}

/** Get current notification permission status */
export function getNotificationPermission(): NotificationPermission {
	if (!browser || !('Notification' in window)) return 'denied';
	return Notification.permission;
}

/** Show a browser notification if permitted and enabled */
export function showNotification(
	title: string,
	options?: NotificationOptions & { onClick?: () => void }
): void {
	if (!browser) return;
	const prefs = getPrefs();
	if (!prefs.notificationsEnabled) return;
	if (Notification.permission !== 'granted') return;

	// Don't notify if the tab is focused
	if (document.hasFocus()) return;

	const notification = new Notification(title, {
		icon: '/pwa-192x192.png',
		badge: '/pwa-192x192.png',
		...options
	});

	if (options?.onClick) {
		const handler = options.onClick;
		notification.addEventListener('click', () => {
			window.focus();
			handler();
			notification.close();
		});
	}

	// Play notification sound
	if (prefs.notificationSound) {
		playNotificationSound();
	}
}

/** Play a subtle notification sound using Web Audio API */
function playNotificationSound(): void {
	if (!browser) return;
	try {
		const ctx = new AudioContext();
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();

		oscillator.connect(gain);
		gain.connect(ctx.destination);

		oscillator.frequency.setValueAtTime(880, ctx.currentTime);
		oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
		oscillator.type = 'sine';

		gain.gain.setValueAtTime(0.1, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

		oscillator.start(ctx.currentTime);
		oscillator.stop(ctx.currentTime + 0.3);

		oscillator.addEventListener('ended', () => {
			ctx.close();
		});
	} catch {
		// AudioContext not available
	}
}

// --- Tab title unread count ---

let originalTitle = '';
let currentUnread = 0;

/** Update the tab title with unread count */
export function updateTabTitle(unreadCount: number): void {
	if (!browser) return;

	if (!originalTitle) {
		originalTitle = document.title;
	}

	currentUnread = unreadCount;

	if (unreadCount > 0) {
		document.title = `(${unreadCount}) ${originalTitle}`;
	} else {
		document.title = originalTitle;
	}
}

/** Get the current unread count shown in the tab title */
export function getTabUnreadCount(): number {
	return currentUnread;
}

// --- Push notification registration ---

/** Register for push notifications with the service worker */
export async function registerPushNotifications(
	vapidPublicKey: string
): Promise<PushSubscription | null> {
	if (!browser || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;

	try {
		const registration = await navigator.serviceWorker.ready;

		const existing = await registration.pushManager.getSubscription();
		if (existing) return existing;

		const keyArray = urlBase64ToUint8Array(vapidPublicKey);
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyArray.buffer as ArrayBuffer
		});

		return subscription;
	} catch {
		return null;
	}
}

/** Convert a URL-safe base64 string to a Uint8Array (for VAPID key) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}
