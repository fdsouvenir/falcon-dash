import { writable, readonly, type Readable, type Writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
	duration: number;
}

const _toasts: Writable<Toast[]> = writable([]);
export const toasts: Readable<Toast[]> = readonly(_toasts);

export function addToast(message: string, type: Toast['type'] = 'info', duration = 4000): void {
	const id = crypto.randomUUID();
	_toasts.update((t) => [...t, { id, message, type, duration }]);
	setTimeout(() => {
		removeToast(id);
	}, duration);
}

export function removeToast(id: string): void {
	_toasts.update((t) => t.filter((toast) => toast.id !== id));
}
