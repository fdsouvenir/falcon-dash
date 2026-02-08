type EventHandler = (payload: unknown) => void;
type Unsubscribe = () => void;

export class EventBus {
	private handlers = new Map<string, Set<EventHandler>>();

	/** Subscribe to an event. Supports wildcards like 'pm.*' */
	on(event: string, handler: EventHandler): Unsubscribe {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler);

		return () => {
			set!.delete(handler);
			if (set!.size === 0) {
				this.handlers.delete(event);
			}
		};
	}

	/** Unsubscribe a specific handler from an event */
	off(event: string, handler: EventHandler): void {
		const set = this.handlers.get(event);
		if (!set) return;
		set.delete(handler);
		if (set.size === 0) {
			this.handlers.delete(event);
		}
	}

	/** Emit an event to all matching handlers (exact + wildcard) */
	emit(event: string, payload: unknown): void {
		// Exact match
		const exact = this.handlers.get(event);
		if (exact) {
			for (const handler of exact) {
				handler(payload);
			}
		}

		// Wildcard match: 'pm.*' matches 'pm.task.created'
		for (const [pattern, handlers] of this.handlers) {
			if (!pattern.endsWith('.*')) continue;
			const prefix = pattern.slice(0, -1); // 'pm.'
			if (event.startsWith(prefix) && event !== pattern) {
				for (const handler of handlers) {
					handler(payload);
				}
			}
		}
	}

	/** Subscribe once — returns a Promise that resolves on next emission */
	once(event: string): Promise<unknown> {
		return new Promise((resolve) => {
			const unsub = this.on(event, (payload) => {
				unsub();
				resolve(payload);
			});
		});
	}

	/** Remove all handlers (called on disconnect) */
	clear(): void {
		this.handlers.clear();
	}
}
