type WorkEvent = {
	type: 'work.changed';
	timestamp: number;
	entity?: string;
	id?: string | number;
	actor?: string;
};

type WorkEventListener = (event: WorkEvent) => void;

const listeners = new Set<WorkEventListener>();
const recentEvents: WorkEvent[] = [];
let stateVersion = 0;

export function onWorkEvent(listener: WorkEventListener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitWorkEvent(event: Omit<WorkEvent, 'timestamp'>): void {
	const payload = { ...event, timestamp: Date.now() };
	stateVersion += 1;
	recentEvents.unshift(payload);
	if (recentEvents.length > 100) recentEvents.pop();
	for (const listener of listeners) listener(payload);
}

export function getRecentWorkEvents(): WorkEvent[] {
	return recentEvents;
}

export function getWorkStateVersion(): number {
	return stateVersion;
}
