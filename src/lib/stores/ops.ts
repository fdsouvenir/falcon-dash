/**
 * Ops Observer store — manages sessions, entries, and SSE streaming.
 */

import { writable, get } from 'svelte/store';
import type { OpsEntry } from '$lib/server/ops/parser.js';

export type { OpsEntry };

export interface SessionInfo {
	filename: string;
	sessionId: string;
	mtime: number;
	size: number;
}

// ── State stores ────────────────────────────────────────────────────────────

export const sessions = writable<SessionInfo[]>([]);
export const currentSessionId = writable<string | null>(null);
export const entries = writable<OpsEntry[]>([]);
export const isLoading = writable(false);
export const autoRefresh = writable(true);
export const refreshInterval = writable(10_000);
export const streamConnected = writable(false);

// ── Internal ─────────────────────────────────────────────────────────────────

let _eventSource: EventSource | null = null;
let _refreshTimer: ReturnType<typeof setInterval> | null = null;

// ── API helpers ──────────────────────────────────────────────────────────────

export async function loadSessions(): Promise<void> {
	try {
		const res = await fetch('/api/ops/sessions');
		if (!res.ok) return;
		const data = await res.json();
		sessions.set(data.sessions ?? []);
	} catch {
		// Silently ignore network errors
	}
}

export async function loadEntries(
	sessionId: string,
	types: 'exec' | 'all' = 'all',
	limit = 50,
	offset = 0
): Promise<void> {
	isLoading.set(true);
	try {
		const params = new URLSearchParams({ types, limit: String(limit), offset: String(offset) });
		const res = await fetch(`/api/ops/session/${encodeURIComponent(sessionId)}?${params}`);
		if (!res.ok) return;
		const data = await res.json();
		const incoming: OpsEntry[] = data.entries ?? [];

		if (offset === 0) {
			entries.set(incoming);
		} else {
			entries.update((prev) => [...prev, ...incoming]);
		}
	} catch {
		// Silently ignore
	} finally {
		isLoading.set(false);
	}
}

export function startStream(sessionId: string): void {
	stopStream();

	const es = new EventSource(`/api/ops/session/${encodeURIComponent(sessionId)}/stream`);
	_eventSource = es;

	es.addEventListener('entry', (e) => {
		try {
			const entry: OpsEntry = JSON.parse(e.data);
			entries.update((prev) => {
				// Insert at the front (most recent), deduplicate by id
				const filtered = prev.filter((x) => x.id !== entry.id);
				return [entry, ...filtered];
			});
		} catch {
			// Ignore malformed SSE data
		}
	});

	es.addEventListener('open', () => streamConnected.set(true));
	es.addEventListener('error', () => {
		streamConnected.set(false);
		// EventSource auto-reconnects
	});
}

export function stopStream(): void {
	if (_eventSource) {
		_eventSource.close();
		_eventSource = null;
		streamConnected.set(false);
	}
}

// ── Auto-refresh ─────────────────────────────────────────────────────────────

export function startAutoRefresh(): void {
	stopAutoRefresh();

	function tick() {
		const sid = get(currentSessionId);
		if (sid) loadEntries(sid);
		loadSessions();
	}

	const interval = get(refreshInterval);
	_refreshTimer = setInterval(tick, interval);
}

export function stopAutoRefresh(): void {
	if (_refreshTimer !== null) {
		clearInterval(_refreshTimer);
		_refreshTimer = null;
	}
}

// ── Computed helpers ─────────────────────────────────────────────────────────

/** Stats derived from entries */
export function computeStats(all: OpsEntry[]) {
	const totalCalls = all.length;
	const execCalls = all.filter((e) => e.toolName === 'exec').length;
	const errors = all.filter((e) => e.status === 'error').length;
	return { totalCalls, execCalls, errors };
}
