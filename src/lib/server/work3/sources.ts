import { existsSync } from 'node:fs';
import type { SourceRef } from '$lib/work3-shared/types.js';
import { getGatewayClient } from '$lib/server/gateway-client.js';
import { getWork3EventsDb } from './db.js';

/**
 * Source-ref resolution (doc 03): references resolve to native records where
 * possible. A missing native source is reported as unavailable — never
 * pretended absent, never silently accepted. Resolution is informational for
 * ordinary sources and enforced only by the human-authority guard.
 */

export interface SourceResolution {
	available: boolean;
	/** Why the source is unavailable/unverified; absent when available. */
	reason?: string;
}

export type SourceKindResolver = (ref: SourceRef) => Promise<SourceResolution>;

interface ChatMessageGetResult {
	ok: boolean;
	message?: unknown;
	unavailableReason?: 'not_found' | 'oversized' | 'not_visible';
}

/** Message refs: `<sessionKey>#<messageId>` (or locator carries the id). */
function parseMessageRef(ref: SourceRef): { sessionKey: string; messageId: string } | null {
	const hash = ref.ref.lastIndexOf('#');
	if (hash > 0 && hash < ref.ref.length - 1) {
		return { sessionKey: ref.ref.slice(0, hash), messageId: ref.ref.slice(hash + 1) };
	}
	if (ref.locator) {
		return { sessionKey: ref.ref, messageId: ref.locator };
	}
	return null;
}

async function resolveMessage(ref: SourceRef): Promise<SourceResolution> {
	const parsed = parseMessageRef(ref);
	if (!parsed) {
		return { available: false, reason: 'malformed_ref (expected sessionKey#messageId)' };
	}
	try {
		const result = await getGatewayClient().call<ChatMessageGetResult>('chat.message.get', {
			sessionKey: parsed.sessionKey,
			messageId: parsed.messageId
		});
		if (result.ok && result.message !== undefined) return { available: true };
		// oversized still proves the record exists.
		if (result.unavailableReason === 'oversized') return { available: true };
		return { available: false, reason: result.unavailableReason ?? 'not_found' };
	} catch (error) {
		return {
			available: false,
			reason: `gateway_unreachable: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Human statements outside gateway history (spoken instruction, meeting note):
 * the recorded statement is itself the native record. Shape was validated at
 * parse; require a label so the claim is at least legible in audits.
 */
async function resolveHumanStatement(ref: SourceRef): Promise<SourceResolution> {
	if (ref.ref.includes('#')) return resolveMessage(ref);
	if (!ref.label || ref.label.trim().length === 0) {
		return { available: false, reason: 'human_statement requires a label quoting the statement' };
	}
	return { available: true };
}

async function resolveFile(ref: SourceRef): Promise<SourceResolution> {
	return existsSync(ref.ref) ? { available: true } : { available: false, reason: 'file_not_found' };
}

async function resolveUrl(ref: SourceRef): Promise<SourceResolution> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3000);
		const response = await fetch(ref.ref, { method: 'HEAD', signal: controller.signal });
		clearTimeout(timer);
		return response.ok || response.status === 405
			? { available: true }
			: { available: false, reason: `http_${response.status}` };
	} catch {
		return { available: false, reason: 'unreachable' };
	}
}

async function resolveWorkEvent(ref: SourceRef): Promise<SourceResolution> {
	const row = getWork3EventsDb().prepare('SELECT 1 FROM events WHERE id = ?').get(ref.ref);
	return row ? { available: true } : { available: false, reason: 'event_not_found' };
}

const resolvers = new Map<string, SourceKindResolver>([
	['message', resolveMessage],
	['human_statement', resolveHumanStatement],
	['file', resolveFile],
	['url', resolveUrl],
	['work_event', resolveWorkEvent]
]);

/** Test/deployment hook: override or add a kind resolver. */
export function setSourceKindResolver(kind: string, resolver: SourceKindResolver): void {
	resolvers.set(kind, resolver);
}

export async function resolveWork3SourceRef(ref: SourceRef): Promise<SourceResolution> {
	const resolver = resolvers.get(ref.kind);
	if (!resolver) {
		// Honest "cannot verify": the ref is kept, but no resolver exists for the
		// kind (e.g. commit, external ticket). Never reported as available.
		return { available: false, reason: `unverifiable_kind:${ref.kind}` };
	}
	return resolver(ref);
}
