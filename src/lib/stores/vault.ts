/**
 * Vault store — client-side state for the KeePassXC passwords page.
 *
 * All mutations go through the /api/vault/* REST endpoints.
 */

import { writable, readonly, type Readable, type Writable } from 'svelte/store';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VaultEntryStub {
	title: string;
	path: string;
}

export interface VaultEntry {
	title: string;
	username: string;
	password: string;
	url: string;
	notes: string;
	path: string;
}

export interface VaultListResult {
	entries: VaultEntryStub[];
	groups: string[];
}

// ── Internal state ────────────────────────────────────────────────────────────

const _available: Writable<boolean> = writable(false);
const _checked: Writable<boolean> = writable(false);
const _loading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);
const _groups: Writable<string[]> = writable([]);
const _currentGroup: Writable<string> = writable('');
const _entries: Writable<VaultEntryStub[]> = writable([]);
const _subGroups: Writable<string[]> = writable([]);

// ── Public readable stores ────────────────────────────────────────────────────

export const vaultAvailable: Readable<boolean> = readonly(_available);
export const vaultChecked: Readable<boolean> = readonly(_checked);
export const vaultLoading: Readable<boolean> = readonly(_loading);
export const vaultError: Readable<string | null> = readonly(_error);
export const vaultGroups: Readable<string[]> = readonly(_groups);
export const currentGroup: Readable<string> = readonly(_currentGroup);
export const vaultEntries: Readable<VaultEntryStub[]> = readonly(_entries);
export const vaultSubGroups: Readable<string[]> = readonly(_subGroups);

// ── Availability check ────────────────────────────────────────────────────────

export async function checkVaultAvailability(): Promise<void> {
	try {
		const res = await fetch('/api/vault/status');
		const data = await res.json();
		_available.set(data.available === true);
	} catch {
		_available.set(false);
	} finally {
		_checked.set(true);
	}
}

// ── Load groups ───────────────────────────────────────────────────────────────

export async function loadGroups(): Promise<void> {
	try {
		const res = await fetch('/api/vault/groups');
		if (!res.ok) return;
		const data = await res.json();
		_groups.set(data.groups ?? []);
	} catch {
		// non-fatal
	}
}

// ── Load entries for a group ──────────────────────────────────────────────────

export async function loadEntries(group?: string): Promise<void> {
	_loading.set(true);
	_error.set(null);
	_currentGroup.set(group ?? '');

	try {
		const params = group ? `?group=${encodeURIComponent(group)}` : '';
		const res = await fetch(`/api/vault/entries${params}`);
		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || `HTTP ${res.status}`);
		}
		const data: VaultListResult = await res.json();
		_entries.set(data.entries);
		_subGroups.set(data.groups);
	} catch (err) {
		_error.set((err as Error).message);
	} finally {
		_loading.set(false);
	}
}

// ── Entry CRUD ────────────────────────────────────────────────────────────────

export async function fetchEntry(path: string): Promise<VaultEntry> {
	const res = await fetch(`/api/vault/entries/${path.split('/').map(encodeURIComponent).join('/')}`);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `HTTP ${res.status}`);
	}
	return res.json();
}

export interface CreateEntryPayload {
	path: string;
	username?: string;
	password?: string;
	url?: string;
	notes?: string;
}

export async function createEntry(payload: CreateEntryPayload): Promise<void> {
	const res = await fetch('/api/vault/entries', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `HTTP ${res.status}`);
	}
}

export interface EditEntryPayload {
	title?: string;
	username?: string;
	password?: string;
	url?: string;
	notes?: string;
}

export async function editEntry(path: string, payload: EditEntryPayload): Promise<void> {
	const res = await fetch(`/api/vault/entries/${path.split('/').map(encodeURIComponent).join('/')}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `HTTP ${res.status}`);
	}
}

export async function deleteEntry(path: string): Promise<void> {
	const res = await fetch(`/api/vault/entries/${path.split('/').map(encodeURIComponent).join('/')}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `HTTP ${res.status}`);
	}
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

export async function createGroup(path: string): Promise<void> {
	const res = await fetch('/api/vault/groups', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `HTTP ${res.status}`);
	}
}

export async function deleteGroup(path: string): Promise<void> {
	const res = await fetch(`/api/vault/groups/${path.split('/').map(encodeURIComponent).join('/')}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `HTTP ${res.status}`);
	}
}
