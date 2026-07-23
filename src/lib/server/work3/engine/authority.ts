import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRef } from '$lib/work3-shared/sources.js';
import type { SourceRef } from '$lib/work3-shared/types.js';
import type { PreGuardContext } from './registry.js';

/**
 * Human-authority-basis guard (doc 02 actor model). Authority-creating acts —
 * decide, grant_authorization, revoke_authorization, waive_verification,
 * completion-criterion waivers — require a human authority basis:
 *
 * - person actor (operator UI): the session itself is the authority basis.
 * - agent actor (the normal case): the command must carry a resolvable
 *   source_ref to the explicit human instruction. The guard enforces presence,
 *   shape, and resolvability — it does not and cannot verify intent; the
 *   integrity mechanism is auditability, not gatekeeping.
 * - system actor: can never grant authority, decide, review, or answer.
 */

export const HUMAN_AUTHORITY_SOURCE_KINDS = ['message', 'human_statement'] as const;

export type AuthoritySourceResolver = (ref: SourceRef) => Promise<boolean>;

let resolveAuthoritySource: AuthoritySourceResolver = async () => true;

/**
 * Install the resolver that checks a claimed human-instruction reference
 * against its native record (e.g. gateway chat history). Defaults to
 * presence/shape-only until source-ref resolution lands (#337).
 */
export function setAuthoritySourceResolver(resolver: AuthoritySourceResolver): void {
	resolveAuthoritySource = resolver;
}

export function extractAuthoritySource(payload: Record<string, unknown>): SourceRef | null {
	const raw = payload.authority_source;
	if (!raw || typeof raw !== 'object') return null;
	const candidate = raw as Record<string, unknown>;
	if (typeof candidate.kind !== 'string' || typeof candidate.ref !== 'string') return null;
	try {
		return parseSourceRef(raw);
	} catch {
		return null;
	}
}

/**
 * Async pre-guard for authority-creating commands. Attach to every command
 * whose effect creates authority (doc 02 lists them exhaustively).
 */
export async function humanAuthorityPreGuard(ctx: PreGuardContext): Promise<void> {
	if (ctx.actor.kind === 'person') return;

	if (ctx.actor.kind === 'system') {
		throw new Work3Error(
			'authority_required',
			'System actors can never perform authority-creating acts'
		);
	}

	const source = extractAuthoritySource(ctx.payload);
	if (!source) {
		throw new Work3Error(
			'authority_required',
			'Authority-creating commands from agents require authority_source: a source_ref to the explicit human instruction ({kind: "message"|"human_statement", ref, summary?})',
			{ details: { actor: `${ctx.actor.kind}:${ctx.actor.id}` } }
		);
	}
	if (!(HUMAN_AUTHORITY_SOURCE_KINDS as readonly string[]).includes(source.kind)) {
		throw new Work3Error(
			'authority_required',
			`authority_source.kind must be one of: ${HUMAN_AUTHORITY_SOURCE_KINDS.join(', ')}`,
			{ details: { provided_kind: source.kind } }
		);
	}
	if (source.ref.trim().length === 0) {
		throw new Work3Error('authority_required', 'authority_source.ref must not be empty');
	}

	const resolvable = await resolveAuthoritySource(source);
	if (!resolvable) {
		throw new Work3Error(
			'authority_required',
			'authority_source does not resolve to a native record',
			{ details: { kind: source.kind, ref: source.ref } }
		);
	}
}
