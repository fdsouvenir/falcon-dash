// @vitest-environment node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getWork3Db,
	listAgentTokens,
	mintAgentToken,
	resolveBearerActor,
	revokeAgentToken
} from './index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from './testing.js';

/**
 * Agent transport auth (#334 release-gate evidence): bearer resolution yields
 * agent actors only — a bearer credential can never produce a person actor.
 */

let context: Work3TestContext;

beforeEach(() => {
	context = setupWork3TestDbs();
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('agent token minting', () => {
	it('mints a token, stores only the hash, and drops a 600-mode token file', () => {
		const minted = mintAgentToken({ agentId: 'main', label: 'Main Agent' });
		expect(minted.token).toMatch(/^fd3_/);

		// Only the hash is at rest.
		const row = getWork3Db()
			.prepare('SELECT token_hash FROM falcon_agent_tokens WHERE id = ?')
			.get(minted.record.id) as { token_hash: string };
		expect(row.token_hash).not.toContain(minted.token);
		expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);

		// Token file for the co-resident CLI.
		expect(existsSync(minted.tokenFile)).toBe(true);
		expect(readFileSync(minted.tokenFile, 'utf-8').trim()).toBe(minted.token);
		expect(statSync(minted.tokenFile).mode & 0o777).toBe(0o600);
	});

	it('revokes the previous token when re-minting for the same agent', () => {
		const first = mintAgentToken({ agentId: 'main' });
		const second = mintAgentToken({ agentId: 'main' });

		expect(resolveBearerActor(`Bearer ${first.token}`)).toBeNull();
		expect(resolveBearerActor(`Bearer ${second.token}`)).toMatchObject({
			kind: 'agent',
			id: 'main'
		});

		const records = listAgentTokens().filter((token) => token.agent_id === 'main');
		expect(records).toHaveLength(2);
		expect(records.filter((token) => token.revoked_at === null)).toHaveLength(1);
	});

	it('rejects agent ids that would escape the token directory', () => {
		expect(() => mintAgentToken({ agentId: '../evil' })).toThrow();
	});
});

describe('bearer actor resolution', () => {
	it('resolves a valid bearer to an agent actor and stamps last_used_at', () => {
		const minted = mintAgentToken({ agentId: 'main', label: 'Main Agent' });
		const actor = resolveBearerActor(`Bearer ${minted.token}`);
		expect(actor).toEqual({ kind: 'agent', id: 'main', label: 'Main Agent' });

		const record = listAgentTokens().find((token) => token.id === minted.record.id);
		expect(record?.last_used_at).not.toBeNull();
	});

	it('never yields a person actor from any bearer credential', () => {
		const minted = mintAgentToken({ agentId: 'main' });
		const actor = resolveBearerActor(`Bearer ${minted.token}`);
		expect(actor?.kind).toBe('agent');
	});

	it('returns null for missing, malformed, unknown, and revoked credentials', () => {
		const minted = mintAgentToken({ agentId: 'main' });

		expect(resolveBearerActor(null)).toBeNull();
		expect(resolveBearerActor('')).toBeNull();
		expect(resolveBearerActor(minted.token)).toBeNull(); // no Bearer prefix
		expect(resolveBearerActor('Bearer nonsense')).toBeNull();
		expect(resolveBearerActor('Bearer fd3_forged')).toBeNull();

		revokeAgentToken(minted.record.id);
		expect(resolveBearerActor(`Bearer ${minted.token}`)).toBeNull();
	});

	it('removes the token file on revocation', () => {
		const minted = mintAgentToken({ agentId: 'main' });
		expect(existsSync(minted.tokenFile)).toBe(true);
		revokeAgentToken(minted.record.id);
		expect(existsSync(minted.tokenFile)).toBe(false);
	});
});
