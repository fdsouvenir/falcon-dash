import { writable, readonly, get, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { eventBus, connection } from '$lib/stores/gateway.js';
import { call } from '$lib/stores/gateway.js';
import { notifyApproval } from '$lib/stores/notifications.js';
import { activeSessionKey } from '$lib/stores/sessions.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingApproval {
	requestId: string;
	command: string;
	agentId: string;
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
// Helpers
// ---------------------------------------------------------------------------

/** Send a follow-up chat message so the agent knows the approval result. */
function notifyAgent(command: string, label: string): void {
	const sessionKey = get(activeSessionKey);
	if (!sessionKey) return;
	call('chat.send', {
		sessionKey,
		message: `[${label}] ${command}`,
		idempotencyKey: crypto.randomUUID(),
		deliver: false
	}).catch(() => {});
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add a pending approval from an event payload.
 * Returns true if auto-denied by denylist (no prompt shown).
 */
export function addPendingApproval(data: Record<string, unknown>): boolean {
	const requestId = data.id as string;
	const request = data.request as Record<string, unknown> | undefined;
	const command = (request?.command as string) ?? '';
	const agentId = (request?.agentId as string) ?? '';

	// Check denylist — auto-deny silently
	let denied = false;
	const unsub = _denylist.subscribe((list) => {
		denied = list.includes(command);
	});
	unsub();

	if (denied) {
		call('exec.approval.resolve', { id: requestId, decision: 'deny' })
			.then(() => notifyAgent(command, 'Exec denied (denylist)'))
			.catch(() => {});
		return true;
	}

	_pendingApprovals.update((list) => [
		...list,
		{ requestId, command, agentId, timestamp: Date.now() }
	]);
	return false;
}

/** Resolve an approval and remove from pending list. */
export async function resolveApproval(
	requestId: string,
	decision: 'allow-once' | 'allow-always' | 'deny'
): Promise<void> {
	// Look up command before removing from list
	const pending = get(_pendingApprovals);
	const approval = pending.find((a) => a.requestId === requestId);
	const command = approval?.command ?? 'unknown';

	await call('exec.approval.resolve', { id: requestId, decision });
	_pendingApprovals.update((list) => list.filter((a) => a.requestId !== requestId));

	const label = decision === 'deny' ? 'Exec denied' : 'Exec approved';
	notifyAgent(command, label);
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

	const helloOk = get(connection.helloOk);
	const scopes = helloOk?.auth?.scopes ?? [];
	if (!scopes.includes('operator.approvals') && !scopes.includes('operator.admin')) {
		console.warn(
			'[exec-approvals] Cannot subscribe: operator.approvals scope not granted by gateway'
		);
		return;
	}

	_eventUnsub = eventBus.on('exec.approval.requested', (data: Record<string, unknown>) => {
		const autoDenied = addPendingApproval(data);
		if (!autoDenied) {
			const request = data.request as Record<string, unknown> | undefined;
			const command = (request?.command as string) ?? 'command';
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
