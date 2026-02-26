import { writable, readonly, derived, get, type Readable } from 'svelte/store';
import { call } from '$lib/stores/gateway.js';
import { setActiveSession, loadSessions } from '$lib/stores/sessions.js';
import { shortId } from '$lib/utils.js';

export interface Channel {
	id: string;
	agentId: string;
	sessionKey: string;
	name: string;
	description?: string;
	position: number;
	createdAt: number;
	isDefault: boolean;
}

const CHANNELS_STORAGE_KEY = 'falcon-dash:channels';
const ACTIVE_CHANNEL_STORAGE_KEY = 'falcon-dash:activeChannelId';

function loadChannelsFromStorage(): Channel[] {
	try {
		if (typeof window === 'undefined') return [];
		const raw = localStorage.getItem(CHANNELS_STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function persistChannels(channels: Channel[]): void {
	try {
		if (typeof window === 'undefined') return;
		localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));
	} catch {
		// Storage unavailable
	}
}

function loadActiveChannelId(): string | null {
	try {
		return typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CHANNEL_STORAGE_KEY) : null;
	} catch {
		return null;
	}
}

function persistActiveChannelId(id: string | null): void {
	try {
		if (typeof window === 'undefined') return;
		if (id) {
			localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, id);
		} else {
			localStorage.removeItem(ACTIVE_CHANNEL_STORAGE_KEY);
		}
	} catch {
		// Storage unavailable
	}
}

const _channels = writable<Channel[]>(loadChannelsFromStorage());
const _activeChannelId = writable<string | null>(loadActiveChannelId());

export const channels: Readable<Channel[]> = readonly(_channels);
export const activeChannelId: Readable<string | null> = readonly(_activeChannelId);

/** Channels for a specific agent, sorted by position */
export function channelsForAgent(agentId: string | null): Readable<Channel[]> {
	return derived(_channels, ($channels) => {
		if (!agentId) return [];
		return $channels.filter((c) => c.agentId === agentId).sort((a, b) => a.position - b.position);
	});
}

/** The currently active channel */
export const activeChannel: Readable<Channel | null> = derived(
	[_channels, _activeChannelId],
	([$channels, $id]) => {
		if (!$id) return null;
		return $channels.find((c) => c.id === $id) ?? null;
	}
);

/** Look up a channel by its session key */
export function channelBySessionKey(sessionKey: string): Channel | null {
	return get(_channels).find((c) => c.sessionKey === sessionKey) ?? null;
}

function buildSessionKey(agentId: string, channelId: string): string {
	return `agent:${agentId}:falcon-dash:dm:fd-chan-${channelId}`;
}

/** Idempotent creation of #general for an agent */
export async function ensureDefaultChannel(agentId: string): Promise<Channel> {
	const existing = get(_channels).find((c) => c.agentId === agentId && c.isDefault);
	if (existing) return existing;

	// Check if a #general session already exists on the gateway (e.g. localStorage was cleared)
	try {
		const result = await call<{
			sessions: Array<{ key: string; label?: string; displayName?: string }>;
		}>('sessions.list', {});
		const generalSession = result.sessions?.find(
			(s) =>
				s.key.startsWith(`agent:${agentId}:falcon-dash:dm:fd-chan-`) &&
				(s.label === '#general' || s.displayName === '#general')
		);
		if (generalSession) {
			// Extract channel id from session key: agent:{agentId}:falcon-dash:dm:fd-chan-{channelId}
			const chanIdMatch = generalSession.key.match(/:fd-chan-(.+)$/);
			const channelId = chanIdMatch ? chanIdMatch[1] : shortId();
			const channel: Channel = {
				id: channelId,
				agentId,
				sessionKey: generalSession.key,
				name: 'general',
				position: 0,
				createdAt: Date.now(),
				isDefault: true
			};
			_channels.update((list) => {
				const next = [...list, channel];
				persistChannels(next);
				return next;
			});
			await loadSessions();
			return channel;
		}
	} catch {
		// Fall through to create new channel
	}

	const id = shortId();
	const sessionKey = buildSessionKey(agentId, id);
	const channel: Channel = {
		id,
		agentId,
		sessionKey,
		name: 'general',
		position: 0,
		createdAt: Date.now(),
		isDefault: true
	};

	// Create session on gateway
	await call('sessions.patch', { key: sessionKey, label: '#general' });

	_channels.update((list) => {
		const next = [...list, channel];
		persistChannels(next);
		return next;
	});

	await loadSessions();
	return channel;
}

/** Create a new named channel for an agent */
export async function createChannel(
	agentId: string,
	name: string,
	description?: string
): Promise<Channel> {
	const id = shortId();
	const sessionKey = buildSessionKey(agentId, id);
	const existing = get(_channels).filter((c) => c.agentId === agentId);
	const maxPosition = existing.reduce((max, c) => Math.max(max, c.position), -1);

	const channel: Channel = {
		id,
		agentId,
		sessionKey,
		name,
		description,
		position: maxPosition + 1,
		createdAt: Date.now(),
		isDefault: false
	};

	// Create session on gateway
	await call('sessions.patch', { key: sessionKey, label: `#${name}` });

	_channels.update((list) => {
		const next = [...list, channel];
		persistChannels(next);
		return next;
	});

	await loadSessions();
	return channel;
}

/** Rename a channel */
export async function renameChannel(id: string, name: string): Promise<void> {
	const channel = get(_channels).find((c) => c.id === id);
	if (!channel) return;

	await call('sessions.patch', { key: channel.sessionKey, label: `#${name}` });

	_channels.update((list) => {
		const next = list.map((c) => (c.id === id ? { ...c, name } : c));
		persistChannels(next);
		return next;
	});
}

/** Delete a channel (guards against default) */
export async function deleteChannel(id: string): Promise<void> {
	const channel = get(_channels).find((c) => c.id === id);
	if (!channel || channel.isDefault) return;

	await call('sessions.delete', { key: channel.sessionKey, deleteTranscript: true });

	_channels.update((list) => {
		const next = list.filter((c) => c.id !== id);
		persistChannels(next);
		return next;
	});

	// If we deleted the active channel, clear it
	if (get(_activeChannelId) === id) {
		_activeChannelId.set(null);
		persistActiveChannelId(null);
	}

	await loadSessions();
}

/** Set the active channel and activate its session */
export function setActiveChannel(id: string): void {
	const channel = get(_channels).find((c) => c.id === id);
	if (!channel) return;

	_activeChannelId.set(id);
	persistActiveChannelId(id);
	setActiveSession(channel.sessionKey);
}

/** Reorder channels within an agent */
export function reorderChannels(agentId: string, orderedIds: string[]): void {
	_channels.update((list) => {
		const next = list.map((c) => {
			if (c.agentId !== agentId) return c;
			const idx = orderedIds.indexOf(c.id);
			return idx >= 0 ? { ...c, position: idx } : c;
		});
		persistChannels(next);
		return next;
	});
}

/** Get channel count for an agent */
export function channelCountForAgent(agentId: string): number {
	return get(_channels).filter((c) => c.agentId === agentId).length;
}

/** Restore active channel on reconnect */
export function restoreActiveChannel(): void {
	const id = loadActiveChannelId();
	if (!id) return;
	const channel = get(_channels).find((c) => c.id === id);
	if (channel) {
		_activeChannelId.set(id);
		setActiveSession(channel.sessionKey);
	}
}

/** Check if a session key belongs to a channel */
export function isChannelSession(sessionKey: string): boolean {
	return sessionKey.includes(':fd-chan-');
}

/** Derived: channel counts per agent */
export const channelCounts: Readable<Record<string, number>> = derived(_channels, ($channels) => {
	const counts: Record<string, number> = {};
	for (const c of $channels) {
		counts[c.agentId] = (counts[c.agentId] ?? 0) + 1;
	}
	return counts;
});
