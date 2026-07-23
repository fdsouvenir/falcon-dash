import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Actor } from '$lib/work3-shared/types.js';
import { getWork3Db, getWork3DbPath } from './db.js';
import { ulid } from './ulid.js';

/**
 * Agent transport auth (doc 06): `/api/v3/*` requires a bearer token, always,
 * and only ever yields `agent` (or `system`) actors. A bearer credential can
 * NEVER produce a person actor — person actorship exists only through the
 * operator UI's in-process path (person.ts). This asymmetry is the spoofing
 * fix: agent traffic is localhost and bypasses Cloudflare Access, so any
 * "no bearer = person" rule would let an agent act as Fred.
 */

const TOKEN_PREFIX = 'fd3_';

export interface AgentTokenRecord {
	id: string;
	agent_id: string;
	label: string;
	created_at: number;
	last_used_at: number | null;
	revoked_at: number | null;
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Directory where token files are dropped for the co-resident CLI. */
export function getTokenFileDir(): string {
	return join(dirname(getWork3DbPath()), 'tokens');
}

export function getTokenFilePath(agentId: string): string {
	if (!/^[A-Za-z0-9_-]+$/.test(agentId)) {
		throw new Error(`Invalid agent id for token file: ${agentId}`);
	}
	return join(getTokenFileDir(), `${agentId}.token`);
}

export interface MintedToken {
	record: AgentTokenRecord;
	/** Plaintext token — only available at mint time. */
	token: string;
	tokenFile: string;
}

/**
 * Mint a new token for an agent. Any prior token for the same agent id is
 * revoked (one active token per agent keeps the token-file semantics simple).
 */
export function mintAgentToken(params: { agentId: string; label?: string }): MintedToken {
	const db = getWork3Db();
	const now = Date.now();
	const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
	const id = ulid(now);
	const label = params.label ?? params.agentId;

	const tokenFile = getTokenFilePath(params.agentId);
	db.transaction(() => {
		db.prepare(
			'UPDATE falcon_agent_tokens SET revoked_at = ? WHERE agent_id = ? AND revoked_at IS NULL'
		).run(now, params.agentId);
		db.prepare(
			`INSERT INTO falcon_agent_tokens (id, agent_id, label, token_hash, created_at)
			 VALUES (?, ?, ?, ?, ?)`
		).run(id, params.agentId, label, hashToken(token), now);
	})();

	mkdirSync(getTokenFileDir(), { recursive: true, mode: 0o700 });
	writeFileSync(tokenFile, token + '\n', { mode: 0o600 });
	chmodSync(tokenFile, 0o600);

	return {
		record: {
			id,
			agent_id: params.agentId,
			label,
			created_at: now,
			last_used_at: null,
			revoked_at: null
		},
		token,
		tokenFile
	};
}

export function revokeAgentToken(id: string): boolean {
	const db = getWork3Db();
	const row = db
		.prepare('SELECT agent_id FROM falcon_agent_tokens WHERE id = ? AND revoked_at IS NULL')
		.get(id) as { agent_id: string } | undefined;
	if (!row) return false;
	db.prepare('UPDATE falcon_agent_tokens SET revoked_at = ? WHERE id = ?').run(Date.now(), id);
	try {
		rmSync(getTokenFilePath(row.agent_id), { force: true });
	} catch {
		/* token file removal is best-effort */
	}
	return true;
}

export function listAgentTokens(): AgentTokenRecord[] {
	return getWork3Db()
		.prepare(
			`SELECT id, agent_id, label, created_at, last_used_at, revoked_at
			 FROM falcon_agent_tokens ORDER BY created_at DESC`
		)
		.all() as AgentTokenRecord[];
}

/**
 * Resolve a bearer credential to an actor. Returns null when missing/invalid.
 * The returned actor is always kind 'agent' — by construction, never 'person'.
 */
export function resolveBearerActor(authorizationHeader: string | null): Actor | null {
	if (!authorizationHeader) return null;
	const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
	if (!match) return null;
	const presented = match[1];
	if (!presented.startsWith(TOKEN_PREFIX)) return null;

	const db = getWork3Db();
	const hash = hashToken(presented);
	const row = db
		.prepare(
			`SELECT id, agent_id, label, token_hash FROM falcon_agent_tokens
			 WHERE token_hash = ? AND revoked_at IS NULL`
		)
		.get(hash) as { id: string; agent_id: string; label: string; token_hash: string } | undefined;
	if (!row) return null;
	// Defense in depth against SQLite collation surprises on the hash lookup.
	if (!timingSafeEqual(Buffer.from(row.token_hash, 'hex'), Buffer.from(hash, 'hex'))) return null;

	db.prepare('UPDATE falcon_agent_tokens SET last_used_at = ? WHERE id = ?').run(
		Date.now(),
		row.id
	);
	return { kind: 'agent', id: row.agent_id, label: row.label };
}
