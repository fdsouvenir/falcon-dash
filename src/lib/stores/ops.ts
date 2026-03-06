/**
 * Ops Observer store — manages entries across all sessions.
 * No session picker — entries from all recent sessions are merged,
 * each entry carries its own sessionId.
 */

import { writable, get } from 'svelte/store';

export interface OpsEntry {
	id: string;
	toolName: string;
	arguments: Record<string, unknown>;
	result?: {
		text: string;
		exitCode?: number;
		durationMs?: number;
		cwd?: string;
	};
	timestamp: number;
	status: 'running' | 'success' | 'error';
	sessionId: string;
}

// ── State stores ────────────────────────────────────────────────────────────

export const entries = writable<OpsEntry[]>([]);
export const isLoading = writable(false);
export const autoRefresh = writable(true);
export const refreshInterval = writable(10_000);

// ── Internal ─────────────────────────────────────────────────────────────────

let _refreshTimer: ReturnType<typeof setInterval> | null = null;

// ── API helpers ──────────────────────────────────────────────────────────────

export async function loadEntries(types: 'exec' | 'all' = 'all', limit = 100): Promise<void> {
	isLoading.set(true);
	try {
		const params = new URLSearchParams({ types, limit: String(limit) });
		const res = await fetch(`/api/ops/entries?${params}`);
		if (!res.ok) return;
		const data = await res.json();
		entries.set(data.entries ?? []);
	} catch {
		// Silently ignore
	} finally {
		isLoading.set(false);
	}
}

// ── Auto-refresh ─────────────────────────────────────────────────────────────

export function startAutoRefresh(): void {
	stopAutoRefresh();

	function tick() {
		loadEntries();
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

export function computeStats(all: OpsEntry[]) {
	const totalCalls = all.length;
	const execCalls = all.filter((e) => e.toolName === 'exec').length;
	const errors = all.filter((e) => e.status === 'error').length;
	const uniqueSessions = new Set(all.map((e) => e.sessionId)).size;
	return { totalCalls, execCalls, errors, uniqueSessions };
}

/** Shorten a session ID for display: first 8 chars. */
export function shortSessionId(sessionId: string): string {
	return sessionId.slice(0, 8);
}
