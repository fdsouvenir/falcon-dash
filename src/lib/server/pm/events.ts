// PM Event System - Server-side
// Handles PM mutations broadcasting and state versioning

export type PMAction = 'created' | 'updated' | 'deleted' | 'moved' | 'reordered' | 'status_changed';
export type PMEntityType = 'domain' | 'focus' | 'project';

export interface PMEvent {
	action: PMAction;
	entityType: PMEntityType;
	entityId: number | string;
	projectId: number | null;
	actor: string;
	data: Record<string, unknown> | null;
	timestamp: number;
	stateVersion: number;
}

// Monotonically incrementing state version
let stateVersion = 0;

export function getStateVersion(): number {
	return stateVersion;
}

// Event listeners (server-side)
type PMEventListener = (event: PMEvent) => void;
const listeners = new Set<PMEventListener>();

export function onPMEvent(listener: PMEventListener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

// Recent event buffer for new connections
const recentEvents: PMEvent[] = [];
const MAX_RECENT = 100;

export function getRecentEvents(since?: number): PMEvent[] {
	if (since !== undefined) {
		return recentEvents.filter((e) => e.stateVersion > since);
	}
	return [...recentEvents];
}

// Emit a PM event
export function emitPMEvent(params: {
	action: PMAction;
	entityType: PMEntityType;
	entityId: number | string;
	projectId?: number | null;
	actor?: string;
	data?: Record<string, unknown> | null;
}): PMEvent {
	stateVersion++;
	const event: PMEvent = {
		action: params.action,
		entityType: params.entityType,
		entityId: params.entityId,
		projectId: params.projectId ?? null,
		actor: params.actor ?? 'system',
		data: params.data ?? null,
		timestamp: Date.now(),
		stateVersion
	};

	// Buffer recent events
	recentEvents.push(event);
	if (recentEvents.length > MAX_RECENT) {
		recentEvents.shift();
	}

	// Notify all listeners
	for (const listener of listeners) {
		try {
			listener(event);
		} catch {
			// Ignore listener errors
		}
	}

	return event;
}

// Helper to create event data for different actions
export function createEventData(
	action: PMAction,
	entity: Record<string, unknown>
): Record<string, unknown> | null {
	switch (action) {
		case 'created':
			return entity; // Full entity
		case 'updated':
		case 'status_changed':
		case 'moved':
			return entity; // Changed fields
		case 'deleted':
			return { id: entity.id }; // Just the ID
		case 'reordered':
			return entity; // Array of ids in new order
		default:
			return null;
	}
}
