import type { Work3Event } from '$lib/work3-shared/types.js';

/**
 * In-process event bus. Emitted post-commit by the transition engine; consumed
 * by the SSE endpoint and the outbox transfer kick. Never a durability
 * mechanism — the Event Log is the durable record.
 */

type Listener = (event: Work3Event) => void;

const listeners = new Set<Listener>();

export function onWork3Event(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitWork3Event(event: Work3Event): void {
	for (const listener of listeners) {
		try {
			listener(event);
		} catch (error) {
			console.error('[work3] bus listener failed:', error);
		}
	}
}
