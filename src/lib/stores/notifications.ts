import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface NotificationSettings {
	soundEnabled: boolean;
	browserNotificationsEnabled: boolean;
	soundVolume: number;
}

const defaultSettings: NotificationSettings = {
	soundEnabled: true,
	browserNotificationsEnabled: false,
	soundVolume: 0.5
};

const _settings: Writable<NotificationSettings> = writable(loadSettings());
const _unreadTotal: Writable<number> = writable(0);
const _originalTitle: string = browser ? document.title : 'Falcon Dash';

export const notificationSettings: Readable<NotificationSettings> = readonly(_settings);
export const unreadTotal: Readable<number> = readonly(_unreadTotal);

function loadSettings(): NotificationSettings {
	if (!browser) return defaultSettings;
	try {
		const stored = localStorage.getItem('falcon-dash-notifications');
		if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
	} catch {
		// Use defaults
	}
	return defaultSettings;
}

export function updateSettings(partial: Partial<NotificationSettings>): void {
	_settings.update((s) => {
		const updated = { ...s, ...partial };
		if (browser) {
			localStorage.setItem('falcon-dash-notifications', JSON.stringify(updated));
		}
		return updated;
	});
}

export function setUnreadTotal(count: number): void {
	_unreadTotal.set(count);
	if (browser) {
		document.title = count > 0 ? `(${count}) ${_originalTitle}` : _originalTitle;
	}
}

export function incrementUnread(): void {
	_unreadTotal.update((n) => {
		const next = n + 1;
		if (browser) {
			document.title = `(${next}) ${_originalTitle}`;
		}
		return next;
	});
}

export function clearUnread(): void {
	_unreadTotal.set(0);
	if (browser) {
		document.title = _originalTitle;
	}
}

/** Play notification sound */
export function playNotificationSound(): void {
	if (!browser) return;
	let settings: NotificationSettings = defaultSettings;
	_settings.subscribe((s) => {
		settings = s;
	})();
	if (!settings.soundEnabled) return;

	try {
		const audio = new Audio('/notification.mp3');
		audio.volume = settings.soundVolume;
		audio.play().catch(() => {
			// Audio play failed (autoplay policy)
		});
	} catch {
		// Audio not available
	}
}

/** Request browser notification permission */
export async function requestNotificationPermission(): Promise<boolean> {
	if (!browser || !('Notification' in window)) return false;
	if (Notification.permission === 'granted') return true;
	if (Notification.permission === 'denied') return false;
	const result = await Notification.requestPermission();
	return result === 'granted';
}

/** Show a browser notification */
export function showBrowserNotification(title: string, body: string): void {
	if (!browser || !('Notification' in window)) return;

	let settings: NotificationSettings = defaultSettings;
	_settings.subscribe((s) => {
		settings = s;
	})();
	if (!settings.browserNotificationsEnabled) return;
	if (Notification.permission !== 'granted') return;
	if (document.hasFocus()) return; // Don't notify when focused

	try {
		new Notification(title, {
			body,
			icon: '/icon-192.svg',
			tag: 'falcon-dash-message'
		});
	} catch {
		// Notification failed
	}
}

/** Notify about a new message */
export function notifyNewMessage(sessionName: string, content: string): void {
	incrementUnread();
	playNotificationSound();
	showBrowserNotification(sessionName, content.slice(0, 200));
}
