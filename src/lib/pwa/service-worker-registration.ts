import { writable } from 'svelte/store';

export const installPromptAvailable = writable(false);

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!('serviceWorker' in navigator)) return null;

	// In dev mode, unregister any existing service worker and clear caches
	// to prevent stale-while-revalidate from ballooning Cache Storage with
	// hashed Vite bundles that are never evicted.
	if (import.meta.env.DEV) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		for (const reg of registrations) {
			await reg.unregister();
		}
		const keys = await caches.keys();
		for (const key of keys) {
			await caches.delete(key);
		}
		return null;
	}

	try {
		const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
		return reg;
	} catch {
		return null;
	}
}

export function listenForInstallPrompt(): void {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
		installPromptAvailable.set(true);
	});

	window.addEventListener('appinstalled', () => {
		deferredPrompt = null;
		installPromptAvailable.set(false);
	});
}

export async function triggerInstall(): Promise<boolean> {
	if (!deferredPrompt) return false;
	deferredPrompt.prompt();
	const result = await deferredPrompt.userChoice;
	deferredPrompt = null;
	installPromptAvailable.set(false);
	return result.outcome === 'accepted';
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Offline queue for actions
const offlineQueue: Array<{ method: string; params: unknown }> = [];

export function queueOfflineAction(method: string, params: unknown): void {
	offlineQueue.push({ method, params });
}

export function getOfflineQueue(): Array<{ method: string; params: unknown }> {
	return [...offlineQueue];
}

export function clearOfflineQueue(): void {
	offlineQueue.length = 0;
}
