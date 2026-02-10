import { connection } from '$lib/stores/gateway.js';
import type { ChatSessionStore } from '$lib/stores/chat.js';

/**
 * Watch connection state and reconcile chat sessions on reconnect.
 * Tracks disconnection duration for silent reconnect (<2s).
 */
export function watchConnectionForChat(chatSession: ChatSessionStore): () => void {
	let disconnectedAt: number | null = null;
	let previousState = '';

	const unsub = connection.state.subscribe((state) => {
		if (state === 'DISCONNECTED' || state === 'RECONNECTING') {
			if (!disconnectedAt) {
				disconnectedAt = Date.now();
			}
		}

		if (state === 'READY' && previousState !== 'READY' && previousState !== '') {
			const wasDisconnected = disconnectedAt !== null;
			const disconnectDuration = disconnectedAt ? Date.now() - disconnectedAt : 0;
			disconnectedAt = null;

			if (wasDisconnected) {
				// Reconcile on reconnect
				chatSession.reconcile();

				// Silent reconnect if <2s — no additional UI indicator needed
				// (The ConnectionStatus component handles visibility based on state)
				if (disconnectDuration >= 2000) {
					// Could emit an event for a reconnection banner in the future
				}
			}
		}

		previousState = state;
	});

	return unsub;
}
