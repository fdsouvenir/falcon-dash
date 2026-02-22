import { writable, readonly, derived, type Readable, type Writable } from 'svelte/store';

export type VaultState = 'checking' | 'no-vault' | 'locked' | 'unlocked';

const _vaultState: Writable<VaultState> = writable('checking');
const _sessionToken: Writable<string | null> = writable(null);
const _error: Writable<string | null> = writable(null);
const _isLoading: Writable<boolean> = writable(false);

export const vaultState: Readable<VaultState> = readonly(_vaultState);
export const sessionToken: Readable<string | null> = readonly(_sessionToken);
export const passwordError: Readable<string | null> = readonly(_error);
export const passwordLoading: Readable<boolean> = readonly(_isLoading);
export const isVaultUnlocked: Readable<boolean> = derived(_vaultState, ($s) => $s === 'unlocked');

export async function checkVaultStatus(): Promise<void> {
	_vaultState.set('checking');
	_error.set(null);
	try {
		const res = await fetch('/api/passwords', {
			headers: { 'x-session-token': '' }
		});
		if (res.status === 404) {
			_vaultState.set('no-vault');
		} else if (res.status === 401) {
			_vaultState.set('locked');
		} else if (res.ok) {
			_vaultState.set('unlocked');
		} else {
			_vaultState.set('locked');
		}
	} catch {
		_vaultState.set('no-vault');
	}
}

export async function initVault(): Promise<boolean> {
	_isLoading.set(true);
	_error.set(null);
	try {
		const res = await fetch('/api/passwords', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'init' })
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.message ?? 'Failed to create vault');
		}
		const data = await res.json();
		_sessionToken.set(data.token);
		_vaultState.set('unlocked');
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	} finally {
		_isLoading.set(false);
	}
}

export async function unlockVault(): Promise<boolean> {
	_isLoading.set(true);
	_error.set(null);
	try {
		const res = await fetch('/api/passwords', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'unlock' })
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.message ?? 'Failed to unlock vault');
		}
		const data = await res.json();
		_sessionToken.set(data.token);
		_vaultState.set('unlocked');
		resetAutoLockTimer();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	} finally {
		_isLoading.set(false);
	}
}

export async function lockVault(): Promise<void> {
	const token = getToken();
	if (token) {
		await fetch('/api/passwords', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'lock', token })
		});
	}
	_sessionToken.set(null);
	_vaultState.set('locked');
}

export function getToken(): string | null {
	let token: string | null = null;
	_sessionToken.subscribe((v) => {
		token = v;
	})();
	return token;
}

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let autoLockTimeoutMs = 5 * 60 * 1000; // 5 minutes default

export function setAutoLockTimeout(ms: number): void {
	autoLockTimeoutMs = ms;
	resetAutoLockTimer();
}

function getCurrentState(): VaultState {
	let state: VaultState = 'checking';
	_vaultState.subscribe((v) => {
		state = v;
	})();
	return state;
}

export function resetAutoLockTimer(): void {
	if (autoLockTimer) clearTimeout(autoLockTimer);
	if (getCurrentState() === 'unlocked') {
		autoLockTimer = setTimeout(() => {
			lockVault();
		}, autoLockTimeoutMs);
	}
}

export function startActivityMonitor(): () => void {
	function onActivity() {
		resetAutoLockTimer();
	}
	document.addEventListener('click', onActivity);
	document.addEventListener('keydown', onActivity);
	document.addEventListener('mousemove', onActivity);
	resetAutoLockTimer();
	return () => {
		document.removeEventListener('click', onActivity);
		document.removeEventListener('keydown', onActivity);
		document.removeEventListener('mousemove', onActivity);
		if (autoLockTimer) clearTimeout(autoLockTimer);
	};
}
