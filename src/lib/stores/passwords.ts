import { writable, get } from 'svelte/store';
import type { PasswordEntry, PasswordEntryFull, VaultState } from '$lib/types';

export const vaultState = writable<VaultState>({ status: 'locked' });
export const passwordEntries = writable<PasswordEntry[]>([]);
export const sessionToken = writable<string>('');

function authHeaders(): Record<string, string> {
	const token = get(sessionToken);
	if (!token) return {};
	return { 'X-Vault-Token': token };
}

export async function checkVault(): Promise<void> {
	const res = await fetch('/api/passwords', {
		headers: authHeaders()
	});
	if (!res.ok) {
		throw new Error(res.statusText);
	}
	const data = await res.json();

	if (!data.available) {
		vaultState.set({ status: 'unavailable' });
		passwordEntries.set([]);
		return;
	}

	if (data.unlocked && data.entries) {
		const entries: PasswordEntry[] = data.entries.map((title: string) => ({
			title
		}));
		passwordEntries.set(entries);
		vaultState.set({ status: 'unlocked', entries });
		return;
	}

	// Available but not unlocked — could be first-run or locked
	// We treat it as locked; the UI can check for first-run separately
	vaultState.set({ status: 'locked' });
	passwordEntries.set([]);
}

export async function unlockVault(masterPassword: string): Promise<void> {
	const res = await fetch('/api/passwords', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'unlock', masterPassword })
	});

	if (!res.ok) {
		const errData = await res.json().catch(() => null);
		throw new Error(errData?.message || 'Failed to unlock vault');
	}

	const data = await res.json();
	sessionToken.set(data.token);

	const entries: PasswordEntry[] = (data.entries || []).map((title: string) => ({
		title
	}));
	passwordEntries.set(entries);
	vaultState.set({ status: 'unlocked', entries });
}

export async function lockVault(): Promise<void> {
	const token = get(sessionToken);
	if (token) {
		await fetch('/api/passwords', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'lock' })
		});
	}

	sessionToken.set('');
	passwordEntries.set([]);
	vaultState.set({ status: 'locked' });
}

export async function initVault(masterPassword: string): Promise<void> {
	const res = await fetch('/api/passwords', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'init', masterPassword })
	});

	if (!res.ok) {
		const errData = await res.json().catch(() => null);
		throw new Error(errData?.message || 'Failed to initialize vault');
	}

	const data = await res.json();
	sessionToken.set(data.token);
	passwordEntries.set([]);
	vaultState.set({ status: 'unlocked', entries: [] });
}

export async function getEntry(entryPath: string): Promise<PasswordEntryFull> {
	const res = await fetch(`/api/passwords/${encodeURIComponent(entryPath)}`, {
		headers: authHeaders()
	});
	if (!res.ok) {
		throw new Error('Failed to get entry');
	}
	return await res.json();
}

export async function createEntry(
	entryPath: string,
	fields: { username?: string; password?: string; url?: string; notes?: string }
): Promise<void> {
	const res = await fetch(`/api/passwords/${encodeURIComponent(entryPath)}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders()
		},
		body: JSON.stringify({ ...fields, create: true })
	});
	if (!res.ok) {
		throw new Error('Failed to create entry');
	}
}

export async function editEntry(
	entryPath: string,
	fields: { username?: string; password?: string; url?: string; notes?: string }
): Promise<void> {
	const res = await fetch(`/api/passwords/${encodeURIComponent(entryPath)}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders()
		},
		body: JSON.stringify(fields)
	});
	if (!res.ok) {
		throw new Error('Failed to edit entry');
	}
}

export async function deleteEntry(entryPath: string): Promise<void> {
	const res = await fetch(`/api/passwords/${encodeURIComponent(entryPath)}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	if (!res.ok) {
		throw new Error('Failed to delete entry');
	}
}
