import { derived, writable, get, type Readable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import type { Session, SessionListResponse, SessionPatchParams } from '$lib/gateway/types';

/** All sessions keyed by session key */
export const sessions = writable<Map<string, Session>>(new Map());

/** Currently active session key */
export const activeSessionKey = writable<string>('');

/** Derived: the currently active session (or undefined if none) */
export const activeSession: Readable<Session | undefined> = derived(
	[sessions, activeSessionKey],
	([$sessions, $key]) => ($key ? $sessions.get($key) : undefined)
);

/** Load sessions from the gateway and populate the store */
export async function loadSessions(): Promise<void> {
	const res = await gateway.call<SessionListResponse>('sessions.list');
	const map = new Map<string, Session>();
	for (const session of res.sessions) {
		map.set(session.key, session);
	}
	sessions.set(map);
}

/** Switch the active session */
export function switchSession(key: string): void {
	activeSessionKey.set(key);
	// Reset unread count for the newly active session
	sessions.update((map) => {
		const session = map.get(key);
		if (session) {
			map.set(key, { ...session, unreadCount: 0 });
		}
		return new Map(map);
	});
}

/** Update session metadata via the gateway and update the local store */
export async function updateSession(
	key: string,
	patch: Omit<SessionPatchParams, 'sessionKey'>
): Promise<void> {
	await gateway.call('sessions.patch', { sessionKey: key, ...patch });
	sessions.update((map) => {
		const session = map.get(key);
		if (session) {
			map.set(key, { ...session, ...patch });
		}
		return new Map(map);
	});
}

/** Increment unread count for a session */
export function incrementUnread(key: string): void {
	sessions.update((map) => {
		const session = map.get(key);
		if (session) {
			map.set(key, { ...session, unreadCount: session.unreadCount + 1 });
		}
		return new Map(map);
	});
}

/** Add a session to the store */
export function addSession(session: Session): void {
	sessions.update((map) => {
		map.set(session.key, session);
		return new Map(map);
	});
}

/** Remove a session from the store */
export function removeSession(key: string): void {
	sessions.update((map) => {
		map.delete(key);
		return new Map(map);
	});
	// If the removed session was active, clear the active key
	if (get(activeSessionKey) === key) {
		activeSessionKey.set('');
	}
}
