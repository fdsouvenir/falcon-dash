import { join } from 'path';
import { homedir } from 'os';

export const VAULT_PATH = join(homedir(), '.openclaw', 'passwords.kdbx');

// In-memory session store (simple for dev; production would use signed tokens)
const sessions = new Map<string, { password: string; expires: number }>();

export function createSession(password: string): string {
	const token = crypto.randomUUID();
	// Session lasts 30 minutes
	sessions.set(token, { password, expires: Date.now() + 30 * 60 * 1000 });
	return token;
}

export function getSession(token: string): string | null {
	const session = sessions.get(token);
	if (!session) return null;
	if (Date.now() > session.expires) {
		sessions.delete(token);
		return null;
	}
	return session.password;
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
