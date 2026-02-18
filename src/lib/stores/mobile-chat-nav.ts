import { writable, derived, readonly, type Readable } from 'svelte/store';
import { sessions } from '$lib/stores/sessions.js';

const _mobileChatOpen = writable(false);

export const mobileChatOpen: Readable<boolean> = readonly(_mobileChatOpen);

export function openMobileChat(): void {
	_mobileChatOpen.set(true);
	// Push history state so browser back gesture closes the panel
	if (typeof window !== 'undefined') {
		history.pushState({ mobileChatOpen: true }, '');
	}
}

export function closeMobileChat(): void {
	_mobileChatOpen.set(false);
}

export const totalUnreadCount: Readable<number> = derived(sessions, ($sessions) =>
	$sessions.reduce((sum, s) => sum + s.unreadCount, 0)
);
