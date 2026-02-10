// PM Event Handler - Client-side
// Subscribes to event:pm broadcasts from gateway and refreshes data stores

import { eventBus } from '$lib/stores/gateway.js';
import { loadDomains, loadFocuses, loadMilestones } from '$lib/stores/pm-domains.js';
import { loadProjects } from '$lib/stores/pm-projects.js';

export interface PMEvent {
	action: string;
	entityType: string;
	entityId: number | string;
	projectId: number | null;
	actor: string;
	data: Record<string, unknown> | null;
	timestamp: number;
	stateVersion: number;
}

let currentStateVersion = 0;

export function getClientStateVersion(): number {
	return currentStateVersion;
}

// Subscribe to PM events from gateway
export function subscribeToPMEvents(): () => void {
	const unsub = eventBus.on('event:pm', (event: unknown) => {
		const pmEvent = event as PMEvent;
		currentStateVersion = pmEvent.stateVersion;
		handlePMEvent(pmEvent);
	});
	return unsub;
}

function handlePMEvent(event: PMEvent): void {
	switch (event.entityType) {
		case 'domain':
			loadDomains();
			break;
		case 'focus':
			loadFocuses();
			break;
		case 'milestone':
			loadMilestones();
			break;
		case 'project':
		case 'task':
			// Reload projects when project/task entities change
			loadProjects();
			break;
		case 'comment':
		case 'block':
		case 'attachment':
			// These don't have stores yet, but will trigger reloads when they do
			break;
	}
}
