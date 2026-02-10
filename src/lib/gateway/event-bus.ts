import type { EventFrame, Frame } from './types.js';

type EventHandler = (payload: Record<string, unknown>, frame: EventFrame) => void;

export class EventBus {
	private handlers = new Map<string, Set<EventHandler>>();
	private wildcardHandlers = new Map<string, Set<EventHandler>>();

	/**
	 * Register a handler for an event. Supports exact names and wildcard patterns (e.g., "pm.*").
	 * Returns an unsubscribe function.
	 */
	on(event: string, handler: EventHandler): () => void {
		const isWildcard = event.includes('*');
		const map = isWildcard ? this.wildcardHandlers : this.handlers;

		let set = map.get(event);
		if (!set) {
			set = new Set();
			map.set(event, set);
		}
		set.add(handler);

		return () => {
			set!.delete(handler);
			if (set!.size === 0) {
				map.delete(event);
			}
		};
	}

	/**
	 * Returns a Promise that resolves on the next occurrence of the event.
	 */
	once(event: string): Promise<Record<string, unknown>> {
		return new Promise((resolve) => {
			const unsubscribe = this.on(event, (payload) => {
				unsubscribe();
				resolve(payload);
			});
		});
	}

	/**
	 * Handle an incoming frame. If it's an event frame, dispatch to matching handlers.
	 * Returns true if the frame was an event.
	 */
	handleFrame(frame: Frame): boolean {
		if (frame.type !== 'event') return false;

		const eventFrame = frame as EventFrame;
		const eventName = eventFrame.event;

		// Dispatch to exact match handlers
		const exactHandlers = this.handlers.get(eventName);
		if (exactHandlers) {
			for (const handler of exactHandlers) {
				try {
					handler(eventFrame.payload, eventFrame);
				} catch (err) {
					console.error(`[EventBus] Handler error for "${eventName}":`, err);
				}
			}
		}

		// Dispatch to wildcard handlers
		for (const [pattern, handlers] of this.wildcardHandlers) {
			if (this.matchWildcard(pattern, eventName)) {
				for (const handler of handlers) {
					try {
						handler(eventFrame.payload, eventFrame);
					} catch (err) {
						console.error(`[EventBus] Wildcard handler error for "${pattern}":`, err);
					}
				}
			}
		}

		return true;
	}

	/**
	 * Clear all handlers (called on disconnect for auto-cleanup).
	 */
	clear(): void {
		this.handlers.clear();
		this.wildcardHandlers.clear();
	}

	/**
	 * Match a wildcard pattern against an event name.
	 * Supports trailing wildcard: "pm.*" matches "pm.task.create", "pm.project.list", etc.
	 * Supports full wildcard: "*" matches everything.
	 */
	private matchWildcard(pattern: string, eventName: string): boolean {
		if (pattern === '*') return true;

		// Convert glob-like pattern to regex
		// "pm.*" → matches any event starting with "pm."
		const prefix = pattern.slice(0, pattern.indexOf('*'));
		return eventName.startsWith(prefix);
	}
}
