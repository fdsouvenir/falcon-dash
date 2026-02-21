import { writable, readonly, derived, get, type Readable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// ---------------------------------------------------------------------------
// Notification types & data model
// ---------------------------------------------------------------------------

export type NotificationCategory = 'chat' | 'system' | 'cron' | 'approval';

export interface AppNotification {
	id: string;
	category: NotificationCategory;
	title: string;
	body: string;
	timestamp: number;
	read: boolean;
	/** Optional navigation target when clicking the notification */
	href?: string;
	/** Session key for chat notifications */
	sessionKey?: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface NotificationSettings {
	soundEnabled: boolean;
	browserNotificationsEnabled: boolean;
	soundVolume: number;
	/** Per-category mute (true = muted) */
	mutedCategories: Record<NotificationCategory, boolean>;
}

const defaultSettings: NotificationSettings = {
	soundEnabled: true,
	browserNotificationsEnabled: false,
	soundVolume: 0.5,
	mutedCategories: { chat: false, system: false, cron: false, approval: false }
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

// ---------------------------------------------------------------------------
// Notification center (ring buffer of recent notifications)
// ---------------------------------------------------------------------------

const MAX_NOTIFICATIONS = 100;
const _notifications: Writable<AppNotification[]> = writable([]);

export const notifications: Readable<AppNotification[]> = readonly(_notifications);
export const unreadNotifications: Readable<AppNotification[]> = derived(_notifications, ($n) =>
	$n.filter((n) => !n.read)
);
export const unreadNotificationCount: Readable<number> = derived(
	unreadNotifications,
	($n) => $n.length
);

export function addNotification(
	category: NotificationCategory,
	title: string,
	body: string,
	opts?: { href?: string; sessionKey?: string }
): void {
	const settings = get(_settings);
	if (settings.mutedCategories[category]) return;

	const notification: AppNotification = {
		id: crypto.randomUUID(),
		category,
		title,
		body,
		timestamp: Date.now(),
		read: false,
		href: opts?.href,
		sessionKey: opts?.sessionKey
	};

	_notifications.update((list) => {
		const next = [notification, ...list];
		if (next.length > MAX_NOTIFICATIONS) next.length = MAX_NOTIFICATIONS;
		return next;
	});
}

export function markNotificationRead(id: string): void {
	_notifications.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllNotificationsRead(): void {
	_notifications.update((list) => list.map((n) => ({ ...n, read: true })));
}

export function clearNotifications(): void {
	_notifications.set([]);
}

// ---------------------------------------------------------------------------
// Unread count & tab title
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sound & browser notifications
// ---------------------------------------------------------------------------

/** Play notification sound */
export function playNotificationSound(): void {
	if (!browser) return;
	const settings = get(_settings);
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
export function showBrowserNotification(title: string, body: string, tag?: string): void {
	if (!browser || !('Notification' in window)) return;

	const settings = get(_settings);
	if (!settings.browserNotificationsEnabled) return;
	if (Notification.permission !== 'granted') return;
	if (document.hasFocus()) return; // Don't notify when focused

	try {
		new Notification(title, {
			body,
			icon: '/icon-192.svg',
			tag: tag ?? 'falcon-dash-message'
		});
	} catch {
		// Notification failed
	}
}

// ---------------------------------------------------------------------------
// High-level notification triggers
// ---------------------------------------------------------------------------

/** Notify about a new chat message */
export function notifyNewMessage(sessionName: string, content: string, sessionKey?: string): void {
	incrementUnread();
	addNotification('chat', sessionName, content.slice(0, 200), {
		href: '/',
		sessionKey
	});
	playNotificationSound();
	showBrowserNotification(
		sessionName,
		content.slice(0, 200),
		sessionKey ? `falcon-dash-chat-${sessionKey}` : undefined
	);
}

/** Notify about a system event */
export function notifySystem(title: string, body: string): void {
	addNotification('system', title, body);
}

/** Notify about a cron job event */
export function notifyCron(jobName: string, body: string): void {
	addNotification('cron', jobName, body, { href: '/jobs' });
	playNotificationSound();
	showBrowserNotification(jobName, body, 'falcon-dash-cron');
}

/** Notify about an exec approval request */
export function notifyApproval(title: string, body: string): void {
	addNotification('approval', title, body, { href: '/settings' });
	playNotificationSound();
	showBrowserNotification(title, body, 'falcon-dash-approval');
}

// ---------------------------------------------------------------------------
// Global event subscriptions (wired in layout for app-wide notifications)
// ---------------------------------------------------------------------------

// Exec approval events are now handled by exec-approvals store.
// These functions remain for other future notification event subscriptions.

let _eventUnsubs: Array<() => void> = [];

export function subscribeToNotificationEvents(): void {
	unsubscribeFromNotificationEvents();
}

export function unsubscribeFromNotificationEvents(): void {
	for (const unsub of _eventUnsubs) unsub();
	_eventUnsubs = [];
}
