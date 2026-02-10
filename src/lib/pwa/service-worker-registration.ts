export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
	if (!('serviceWorker' in navigator)) return null;
	try {
		const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
		return reg;
	} catch {
		return null;
	}
}

export function showInstallPrompt(): void {
	// Listen for beforeinstallprompt
	let deferredPrompt: BeforeInstallPromptEvent | null = null;

	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
	});

	// Expose install function
	(globalThis as Record<string, unknown>).__installPWA = async () => {
		if (!deferredPrompt) return false;
		deferredPrompt.prompt();
		const result = await deferredPrompt.userChoice;
		deferredPrompt = null;
		return result.outcome === 'accepted';
	};
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
