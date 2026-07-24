import { invalidate } from '$app/navigation';

interface EventSourceLike {
	addEventListener(type: string, listener: EventListener): void;
	removeEventListener(type: string, listener: EventListener): void;
	close(): void;
}

interface QueueLiveOptions {
	debounceMs?: number;
	eventSourceFactory?: (url: string) => EventSourceLike;
	invalidateQueue?: (dependency: string) => unknown;
}

export function connectWorkQueueLive(options: QueueLiveOptions = {}): () => void {
	const factory =
		options.eventSourceFactory ??
		(typeof EventSource === 'undefined'
			? null
			: (url: string): EventSourceLike => new EventSource(url));
	if (!factory) return () => {};

	let source: EventSourceLike;
	try {
		source = factory('/api/work3/events');
	} catch {
		return () => {};
	}

	const debounceMs = options.debounceMs ?? 250;
	const invalidateQueue = options.invalidateQueue ?? invalidate;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const refresh: EventListener = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			void invalidateQueue('work3:queue');
		}, debounceMs);
	};

	source.addEventListener('work3', refresh);

	return () => {
		if (timer) clearTimeout(timer);
		source.removeEventListener('work3', refresh);
		source.close();
	};
}
