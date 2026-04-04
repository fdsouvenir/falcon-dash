import { writable, readonly, get, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { rpc, gatewayEvents } from '$lib/gateway-api.js';
import { notifyApproval } from '$lib/stores/notifications.js';
import { activeSessionKey } from '$lib/stores/sessions.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingApproval {
	requestId: string;
	command: string;
	agentId: string;
	sessionKey: string;
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
function notifyAgent(command: string, label: string, sessionKey?: string): void {
	const targetSessionKey = sessionKey ?? get(activeSessionKey);
	if (!targetSessionKey) return;
	rpc('chat.send', {
		sessionKey: targetSessionKey,
		message: `[${label}] ${command}`,
		idempotencyKey: crypto.randomUUID(),
		deliver: false
	}).catch(() => {});
}

function extractApproval(data: Record<string, unknown>): PendingApproval {
	const request = data.request as Record<string, unknown> | undefined;
	const fallbackSessionKey = get(activeSessionKey) ?? '';
	const requestTimestamp =
		typeof request?.timestamp === 'number' &&
		Number.isFinite(request.timestamp) &&
		request.timestamp > 0
			? request.timestamp
			: null;
	const eventTimestamp =
		typeof data.timestamp === 'number' && Number.isFinite(data.timestamp) && data.timestamp > 0
			? data.timestamp
			: null;

	return {
		requestId: (data.id as string) ?? '',
		command: (request?.command as string) ?? '',
		agentId: (request?.agentId as string) ?? '',
		sessionKey:
			(request?.sessionKey as string) ?? (data.sessionKey as string) ?? fallbackSessionKey,
		timestamp: requestTimestamp ?? eventTimestamp ?? Date.now()
	};
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add a pending approval from an event payload.
 * Returns true if auto-denied by denylist (no prompt shown).
 */
export function addPendingApproval(data: Record<string, unknown>): boolean {
	const approval = extractApproval(data);

	// Check denylist — auto-deny silently
	let denied = false;
	const unsub = _denylist.subscribe((list) => {
		denied = list.includes(approval.command);
	});
	unsub();

	if (denied) {
		rpc('exec.approval.resolve', { id: approval.requestId, decision: 'deny' })
			.then(() => notifyAgent(approval.command, 'Exec denied (denylist)', approval.sessionKey))
			.catch(() => {});
		return true;
	}

	_pendingApprovals.update((list) => [...list, approval]);
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
	const sessionKey = approval?.sessionKey;

	await rpc('exec.approval.resolve', { id: requestId, decision });
	_pendingApprovals.update((list) => list.filter((a) => a.requestId !== requestId));

	const label = decision === 'deny' ? 'Exec denied' : 'Exec approved';
	notifyAgent(command, label, sessionKey);
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

	const snap = get(gatewayEvents.snapshot);
	const scopes = snap?.auth?.scopes ?? [];
	if (!scopes.includes('operator.approvals') && !scopes.includes('operator.admin')) {
		console.warn(
			'[exec-approvals] Cannot subscribe: operator.approvals scope not granted by gateway'
		);
		return;
	}

	_eventUnsub = gatewayEvents.on('exec.approval.requested', (data: Record<string, unknown>) => {
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

export function resetExecApprovalsForTests(): void {
	_pendingApprovals.set([]);
	_denylist.set([]);
}
