import { Resolver } from 'node:dns/promises';
import { existsSync, realpathSync } from 'node:fs';
import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { homedir } from 'node:os';
import {
	delimiter,
	dirname,
	isAbsolute,
	join,
	parse as parsePath,
	relative,
	resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import ipaddr from 'ipaddr.js';
import { MAX_SOURCE_REFS } from '$lib/work3-shared/sources.js';
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

export type SourceKindResolver = (
	ref: SourceRef,
	signal?: AbortSignal
) => Promise<SourceResolution>;

export interface SourceResolutionBatch {
	resolutions: SourceResolution[];
	omitted: number;
}

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

function findApplicationRoot(start: string): string | null {
	let current = resolve(start);
	for (;;) {
		if (existsSync(join(current, 'package.json'))) return current;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

const applicationRoot = findApplicationRoot(dirname(fileURLToPath(import.meta.url)));

interface ApprovedSourceRoot {
	requested: string;
	canonical: string;
}

function approvedRoot(raw: string): ApprovedSourceRoot | null {
	const requested = resolve(raw);
	if (requested === parsePath(requested).root) return null;
	try {
		const canonical = realpathSync.native(requested);
		return canonical === parsePath(canonical).root ? null : { requested, canonical };
	} catch {
		return { requested, canonical: requested };
	}
}

function sourceFileRoots(): ApprovedSourceRoot[] {
	const configured = (process.env.FALCON_DASH_SOURCE_ROOTS ?? '')
		.split(delimiter)
		.map((root) => root.trim())
		.filter(Boolean);
	return [
		...(applicationRoot ? [applicationRoot] : []),
		join(homedir(), '.openclaw'),
		join(homedir(), '.npm-global', 'lib', 'node_modules', 'openclaw'),
		...configured
	]
		.map(approvedRoot)
		.filter((root): root is ApprovedSourceRoot => root !== null);
}

function pathIsWithin(root: string, candidate: string): boolean {
	const pathFromRoot = relative(root, candidate);
	return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}

async function resolveFile(ref: SourceRef): Promise<SourceResolution> {
	const candidate = resolve(ref.ref);
	const roots = sourceFileRoots();
	if (
		!roots.some(
			(root) => pathIsWithin(root.requested, candidate) || pathIsWithin(root.canonical, candidate)
		)
	) {
		return { available: false, reason: 'outside_approved_source_roots' };
	}
	if (!existsSync(candidate)) return { available: false, reason: 'file_not_found' };
	let realCandidate: string;
	try {
		realCandidate = realpathSync.native(candidate);
	} catch {
		return { available: false, reason: 'file_not_found' };
	}
	if (!roots.some((root) => pathIsWithin(root.canonical, realCandidate))) {
		return { available: false, reason: 'outside_approved_source_roots' };
	}
	return { available: true };
}

function unsafeIp(address: string): boolean {
	try {
		// process() normalizes every IPv4-mapped IPv6 spelling to IPv4 before
		// range classification. Only globally routable unicast is eligible.
		return ipaddr.process(address).range() !== 'unicast';
	} catch {
		return true;
	}
}

async function resolveHostname(
	hostname: string
): Promise<Array<{ address: string; family: 4 | 6 }>> {
	if (isIP(hostname) > 0) {
		return [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
	}
	const resolver = new Resolver({ timeout: 1000, tries: 1 });
	const [ipv4, ipv6] = await Promise.allSettled([
		resolver.resolve4(hostname),
		resolver.resolve6(hostname)
	]);
	return [
		...(ipv4.status === 'fulfilled'
			? ipv4.value.map((address) => ({ address, family: 4 as const }))
			: []),
		...(ipv6.status === 'fulfilled'
			? ipv6.value.map((address) => ({ address, family: 6 as const }))
			: [])
	];
}

interface ValidatedPublicUrl {
	url: URL;
	address: string;
	family: 4 | 6;
}

interface UrlHeadResult {
	status: number;
	location?: string;
}

export type SourceUrlHeadRequest = (
	target: ValidatedPublicUrl,
	signal?: AbortSignal
) => Promise<UrlHeadResult>;

async function validatePublicUrl(raw: string): Promise<ValidatedPublicUrl | SourceResolution> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { available: false, reason: 'invalid_url' };
	}
	if (!['http:', 'https:'].includes(url.protocol)) {
		return { available: false, reason: 'unsupported_url_protocol' };
	}
	if (url.username || url.password) {
		return { available: false, reason: 'url_credentials_not_allowed' };
	}
	const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
		return { available: false, reason: 'private_url_destination' };
	}
	try {
		const addresses = await resolveHostname(hostname);
		if (addresses.length === 0) {
			return { available: false, reason: 'unreachable' };
		}
		if (addresses.some(({ address }) => unsafeIp(address))) {
			return { available: false, reason: 'private_url_destination' };
		}
		const selected = addresses[0];
		return {
			url,
			address: selected.address,
			family: selected.family as 4 | 6
		};
	} catch {
		return { available: false, reason: 'unreachable' };
	}
}

async function requestUrlHeadPinned(
	target: ValidatedPublicUrl,
	signal?: AbortSignal
): Promise<UrlHeadResult> {
	const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
		if (options.all) {
			callback(null, [{ address: target.address, family: target.family }]);
			return;
		}
		callback(null, target.address, target.family);
	};
	const request = target.url.protocol === 'https:' ? requestHttps : requestHttp;
	return new Promise((resolveRequest, rejectRequest) => {
		const outgoing = request(
			target.url,
			{
				method: 'HEAD',
				agent: false,
				lookup: pinnedLookup,
				signal
			},
			(response) => {
				clearTimeout(absoluteTimer);
				response.resume();
				resolveRequest({
					status: response.statusCode ?? 0,
					...(response.headers.location ? { location: response.headers.location } : {})
				});
			}
		);
		const absoluteTimer = setTimeout(
			() => outgoing.destroy(new Error('source request timeout')),
			3000
		);
		outgoing.once('error', (error) => {
			clearTimeout(absoluteTimer);
			rejectRequest(error);
		});
		outgoing.end();
	});
}

let urlHeadRequest: SourceUrlHeadRequest = requestUrlHeadPinned;

/** Test hook for exercising redirect validation without outbound requests. */
export function setSourceUrlHeadRequestForTests(request?: SourceUrlHeadRequest): void {
	urlHeadRequest = request ?? requestUrlHeadPinned;
}

async function resolveUrl(ref: SourceRef, signal?: AbortSignal): Promise<SourceResolution> {
	let current = ref.ref;
	for (let redirects = 0; redirects <= 5; redirects += 1) {
		if (signal?.aborted) return { available: false, reason: 'resolution_timeout' };
		const validated = await validatePublicUrl(current);
		if ('available' in validated) return validated;
		if (signal?.aborted) return { available: false, reason: 'resolution_timeout' };
		try {
			const response = await urlHeadRequest(validated, signal);
			if (response.status >= 300 && response.status < 400) {
				if (!response.location) {
					return { available: false, reason: `http_${response.status}` };
				}
				current = new URL(response.location, validated.url).toString();
				continue;
			}
			return (response.status >= 200 && response.status < 300) || response.status === 405
				? { available: true }
				: { available: false, reason: `http_${response.status}` };
		} catch {
			return {
				available: false,
				reason: signal?.aborted ? 'resolution_timeout' : 'unreachable'
			};
		}
	}
	return { available: false, reason: 'too_many_redirects' };
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
	sourceResolutionCache.clear();
}

export async function resolveWork3SourceRef(
	ref: SourceRef,
	signal?: AbortSignal
): Promise<SourceResolution> {
	const resolver = resolvers.get(ref.kind);
	if (!resolver) {
		// Honest "cannot verify": the ref is kept, but no resolver exists for the
		// kind (e.g. commit, external ticket). Never reported as available.
		return { available: false, reason: `unverifiable_kind:${ref.kind}` };
	}
	return resolver(ref, signal);
}

const sourceResolutionCache = new Map<
	string,
	{ expiresAt: number; resolution: Promise<SourceResolution> }
>();
const SOURCE_RESOLUTION_CACHE_MS = 15_000;
const SOURCE_RESOLUTION_CACHE_MAX = 256;
const SOURCE_RESOLUTION_CACHE_KEY_MAX = 8192;

function pruneSourceResolutionCache(now: number): void {
	for (const [key, entry] of sourceResolutionCache) {
		if (entry.expiresAt <= now) sourceResolutionCache.delete(key);
	}
	while (sourceResolutionCache.size >= SOURCE_RESOLUTION_CACHE_MAX) {
		const oldestKey = sourceResolutionCache.keys().next().value;
		if (oldestKey === undefined) break;
		sourceResolutionCache.delete(oldestKey);
	}
}

function resolveCachedSourceRef(ref: SourceRef, signal?: AbortSignal): Promise<SourceResolution> {
	// URL probes are abortable per display request. Sharing them through the
	// cache would let one batch's deadline cancel another batch's socket.
	if (ref.kind === 'url') return resolveWork3SourceRef(ref, signal);
	const key = JSON.stringify(ref);
	const now = Date.now();
	if (key.length > SOURCE_RESOLUTION_CACHE_KEY_MAX) return resolveWork3SourceRef(ref);
	const cached = sourceResolutionCache.get(key);
	if (cached && cached.expiresAt > now) {
		sourceResolutionCache.delete(key);
		sourceResolutionCache.set(key, cached);
		return cached.resolution;
	}
	pruneSourceResolutionCache(now);
	const resolution = resolveWork3SourceRef(ref).catch((error) => {
		sourceResolutionCache.delete(key);
		throw error;
	});
	sourceResolutionCache.set(key, {
		expiresAt: now + SOURCE_RESOLUTION_CACHE_MS,
		resolution
	});
	return resolution;
}

function resolveBeforeDeadline(
	resolution: Promise<SourceResolution>,
	remainingMs: number,
	onTimeout: () => void
): Promise<SourceResolution> {
	if (remainingMs <= 0) {
		onTimeout();
		return Promise.resolve({ available: false, reason: 'resolution_timeout' });
	}
	return new Promise((resolveResult) => {
		const timer = setTimeout(() => {
			onTimeout();
			resolveResult({ available: false, reason: 'resolution_timeout' });
		}, remainingMs);
		resolution.then(
			(result) => {
				clearTimeout(timer);
				resolveResult(result);
			},
			() => {
				clearTimeout(timer);
				resolveResult({ available: false, reason: 'resolution_failed' });
			}
		);
	});
}

/** Resolve a bounded display batch without opening an unbounded number of sockets. */
export async function resolveWork3SourceRefs(
	refs: SourceRef[],
	options: { concurrency?: number; limit?: number; deadlineMs?: number } = {}
): Promise<SourceResolutionBatch> {
	const limit = Math.max(0, Math.min(options.limit ?? MAX_SOURCE_REFS, MAX_SOURCE_REFS));
	const selected = refs.slice(0, limit);
	const resolutions = new Array<SourceResolution>(selected.length);
	const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8, selected.length || 1));
	const deadlineMs = Math.max(50, Math.min(options.deadlineMs ?? 4000, 10_000));
	const deadlineAt = Date.now() + deadlineMs;
	const deadlineController = new AbortController();
	const deadlineTimer = setTimeout(() => deadlineController.abort(), deadlineMs);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		for (;;) {
			if (Date.now() >= deadlineAt) return;
			const index = nextIndex;
			nextIndex += 1;
			if (index >= selected.length) return;
			resolutions[index] = await resolveBeforeDeadline(
				resolveCachedSourceRef(selected[index], deadlineController.signal),
				deadlineAt - Date.now(),
				() => deadlineController.abort()
			);
		}
	}

	try {
		await Promise.all(Array.from({ length: concurrency }, () => worker()));
	} finally {
		clearTimeout(deadlineTimer);
	}
	for (let index = 0; index < resolutions.length; index += 1) {
		resolutions[index] ??= { available: false, reason: 'resolution_timeout' };
	}
	return {
		resolutions,
		omitted: Math.max(0, refs.length - selected.length)
	};
}
