import { join } from 'path';
import { homedir } from 'os';

export const VAULT_PATH = join(homedir(), '.openclaw', 'passwords.kdbx');
export const KEY_FILE_PATH = join(homedir(), '.openclaw', 'vault.key');

// In-memory session store — tracks that the vault is unlocked (no password stored)
const sessions = new Map<string, { expires: number }>();

export function createSession(): string {
	const token = crypto.randomUUID();
	// Session lasts 30 minutes
	sessions.set(token, { expires: Date.now() + 30 * 60 * 1000 });
	return token;
}

export function getSession(token: string): boolean {
	const session = sessions.get(token);
	if (!session) return false;
	if (Date.now() > session.expires) {
		sessions.delete(token);
		return false;
	}
	return true;
}

export function clearSession(token: string): void {
	sessions.delete(token);
}

export function clearAllSessions(): void {
	sessions.clear();
}

export function refreshSession(token: string): void {
	const session = sessions.get(token);
	if (session) {
		session.expires = Date.now() + 30 * 60 * 1000;
	}
}
