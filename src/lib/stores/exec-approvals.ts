import { writable, readonly, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { eventBus } from '$lib/stores/gateway.js';
import { call } from '$lib/stores/gateway.js';
import { notifyApproval } from '$lib/stores/notifications.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingApproval {
	requestId: string;
	command: string;
	args: string[];
	nodeId: string;
	timestamp: number;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const DENYLIST_KEY = 'falcon-dash-exec-denylist';

const _pendingApprovals = writable<PendingApproval[]>([]);
const _denylist = writable<string[]>(loadDenylist());

export const pendingApprovals: Readable<PendingApproval[]> = readonly(_pendingApprovals);
export const denylist: Readable<string[]> = readonly(_denylist);

// ---------------------------------------------------------------------------
// Denylist persistence
// ---------------------------------------------------------------------------

function loadDenylist(): string[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(DENYLIST_KEY);
		if (stored) return JSON.parse(stored);
	} catch {
		// Use empty
	}
	return [];
}

function persistDenylist(list: string[]): void {
	if (!browser) return;
	localStorage.setItem(DENYLIST_KEY, JSON.stringify(list));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add a pending approval from an event payload.
 * Returns true if auto-denied by denylist (no prompt shown).
 */
export function addPendingApproval(data: Record<string, unknown>): boolean {
	const command = (data.command as string) ?? '';
	const args = (data.args as string[]) ?? [];
	const requestId = data.requestId as string;
	const nodeId = (data.nodeId as string) ?? '';

	// Check denylist — auto-deny silently
	let denied = false;
	const unsub = _denylist.subscribe((list) => {
		denied = list.includes(command);
	});
	unsub();

	if (denied) {
		call('exec-approval.resolve', { requestId, decision: 'deny' }).catch(() => {});
		return true;
	}

	_pendingApprovals.update((list) => [
		...list,
		{ requestId, command, args, nodeId, timestamp: Date.now() }
	]);
	return false;
}

/** Resolve an approval and remove from pending list. */
export async function resolveApproval(
	requestId: string,
	decision: 'allow-once' | 'allow-always' | 'deny'
): Promise<void> {
	await call('exec-approval.resolve', { requestId, decision });
	_pendingApprovals.update((list) => list.filter((a) => a.requestId !== requestId));
}

/** Add a command to the denylist. */
export function addToDenylist(command: string): void {
	_denylist.update((list) => {
		if (list.includes(command)) return list;
		const next = [...list, command];
		persistDenylist(next);
		return next;
	});
}

/** Remove a command from the denylist. */
export function removeFromDenylist(command: string): void {
	_denylist.update((list) => {
		const next = list.filter((c) => c !== command);
		persistDenylist(next);
		return next;
	});
}

// ---------------------------------------------------------------------------
// Event subscription
// ---------------------------------------------------------------------------

let _eventUnsub: (() => void) | null = null;

export function subscribeToApprovalEvents(): void {
	unsubscribeFromApprovalEvents();
	_eventUnsub = eventBus.on('exec-approval.requested', (data: Record<string, unknown>) => {
		const autoDenied = addPendingApproval(data);
		if (!autoDenied) {
			const command = (data.command as string) ?? 'command';
			notifyApproval('Approval requested', `${command} needs approval`);
		}
	});
}

export function unsubscribeFromApprovalEvents(): void {
	if (_eventUnsub) {
		_eventUnsub();
		_eventUnsub = null;
	}
}
