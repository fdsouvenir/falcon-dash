import { describe, expect, it } from 'vitest';
import {
	dedupeEquivalentSessions,
	equivalentSessionGroupKey,
	type ChatSessionInfo
} from './sessions.js';

function buildSession(
	sessionKey: string,
	overrides: Partial<ChatSessionInfo> = {}
): ChatSessionInfo {
	return {
		sessionKey,
		displayName: overrides.displayName ?? sessionKey,
		createdAt: overrides.createdAt ?? 1,
		updatedAt: overrides.updatedAt ?? 1,
		unreadCount: overrides.unreadCount ?? 0,
		kind: overrides.kind ?? 'direct',
		name: overrides.name,
		channel: overrides.channel,
		model: overrides.model,
		totalTokens: overrides.totalTokens,
		contextTokens: overrides.contextTokens,
		ageMs: overrides.ageMs
	};
}

describe('sessions store helpers', () => {
	it('normalizes legacy falcon-dash channel keys to the canonical falcon group key', () => {
		expect(equivalentSessionGroupKey('agent:main:falcon-dash:dm:fd-chan-abc123')).toBe(
			'agent:main:falcon:dm:fd-chan-abc123'
		);
		expect(equivalentSessionGroupKey('agent:main:webchat:dm:fd-chat-1234')).toBe(
			'agent:main:webchat:dm:fd-chat-1234'
		);
	});

	it('dedupes equivalent channel sessions and prefers the canonical falcon key', () => {
		const sessions = dedupeEquivalentSessions([
			buildSession('agent:main:falcon-dash:dm:fd-chan-abc123', {
				displayName: 'Telegram Fred',
				updatedAt: 100
			}),
			buildSession('agent:main:falcon:dm:fd-chan-abc123', {
				displayName: 'Telegram Fred',
				updatedAt: 90
			}),
			buildSession('agent:main:webchat:dm:fd-chat-xyz987', {
				displayName: 'Web chat'
			})
		]);

		expect(sessions).toHaveLength(2);
		expect(sessions.find((session) => session.displayName === 'Telegram Fred')?.sessionKey).toBe(
			'agent:main:falcon:dm:fd-chan-abc123'
		);
	});

	it('keeps the newest session when only legacy alias variants are present', () => {
		const sessions = dedupeEquivalentSessions([
			buildSession('agent:main:falcon-dash:dm:fd-chan-abc123', { updatedAt: 100 }),
			buildSession('agent:main:falcon-dash:dm:fd-chan-abc123', { updatedAt: 200 })
		]);

		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.updatedAt).toBe(200);
	});
});
