import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectWorkQueueLive } from './live.js';

afterEach(() => {
	vi.useRealTimers();
});

describe('Work queue live refresh', () => {
	it('debounces Work events and cleans up the stream', () => {
		vi.useFakeTimers();
		const listeners = new Map<string, EventListener>();
		const close = vi.fn();
		const invalidateQueue = vi.fn();
		const cleanup = connectWorkQueueLive({
			debounceMs: 100,
			invalidateQueue,
			eventSourceFactory: () => ({
				addEventListener: (type, listener) => listeners.set(type, listener),
				removeEventListener: (type) => listeners.delete(type),
				close
			})
		});

		listeners.get('work3')?.(new Event('work3'));
		vi.advanceTimersByTime(50);
		listeners.get('work3')?.(new Event('work3'));
		vi.advanceTimersByTime(99);
		expect(invalidateQueue).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(invalidateQueue).toHaveBeenCalledOnce();
		expect(invalidateQueue).toHaveBeenCalledWith('work3:queue');

		cleanup();
		expect(listeners.has('work3')).toBe(false);
		expect(close).toHaveBeenCalledOnce();
	});

	it('degrades silently when EventSource construction fails', () => {
		expect(() =>
			connectWorkQueueLive({
				eventSourceFactory: () => {
					throw new Error('unavailable');
				}
			})()
		).not.toThrow();
	});
});
