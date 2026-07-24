// @vitest-environment node

import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SOURCE_REFS, parseSourceRef, parseSourceRefs } from '$lib/work3-shared/sources.js';
import {
	allocateEntityId,
	executeCommand,
	insertEntity,
	registerCommand,
	resolveWork3SourceRef,
	resolveWork3SourceRefs,
	setSourceKindResolver,
	transferWork3OutboxOnce
} from './index.js';
import { setSourceUrlHeadRequestForTests } from './sources.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from './testing.js';

/**
 * Source-ref schema + resolution (#337 release-gate evidence): shape
 * validation, per-kind resolution, and the explicit unavailable state.
 */

let context: Work3TestContext;
let fileDir: string;

beforeEach(() => {
	context = setupWork3TestDbs();
	fileDir = mkdtempSync(join(process.cwd(), '.falcon-sources-'));
});

afterEach(() => {
	teardownWork3TestDbs(context);
	rmSync(fileDir, { recursive: true, force: true });
	setSourceUrlHeadRequestForTests();
	vi.unstubAllGlobals();
});

describe('source-ref schema', () => {
	it('validates the doc-03 shape and rejects malformed refs', () => {
		expect(
			parseSourceRef({ kind: 'file', ref: '/tmp/x', label: 'X', captured_at: 123 })
		).toMatchObject({
			kind: 'file',
			ref: '/tmp/x'
		});
		expect(() => parseSourceRef({ kind: 'file' })).toThrowError(
			expect.objectContaining({ code: 'validation_failed' })
		);
		expect(() => parseSourceRef({ ref: 'x' })).toThrowError(
			expect.objectContaining({ code: 'validation_failed' })
		);
		expect(() =>
			parseSourceRef({ kind: 'file', ref: '/x', captured_at: 'yesterday' })
		).toThrowError(expect.objectContaining({ code: 'validation_failed' }));
		expect(() =>
			parseSourceRef({ kind: 'url', ref: `https://example.com/${'x'.repeat(5000)}` })
		).toThrowError(/at most/);
	});

	it('enforces required-ness for source_refs arrays', () => {
		expect(() => parseSourceRefs(undefined, { required: true })).toThrow();
		expect(() => parseSourceRefs([], { required: true })).toThrow();
		expect(parseSourceRefs(undefined)).toEqual([]);
		expect(() =>
			parseSourceRefs(
				Array.from({ length: MAX_SOURCE_REFS + 1 }, (_, index) => ({
					kind: 'work_event',
					ref: `event-${index}`
				}))
			)
		).toThrowError(/at most/);
	});
});

describe('per-kind resolution', () => {
	it('file refs resolve by existence; missing files are unavailable', async () => {
		const path = join(fileDir, 'evidence.txt');
		writeFileSync(path, 'proof');
		expect(await resolveWork3SourceRef({ kind: 'file', ref: path })).toEqual({ available: true });
		expect(await resolveWork3SourceRef({ kind: 'file', ref: join(fileDir, 'gone.txt') })).toEqual({
			available: false,
			reason: 'file_not_found'
		});
	});

	it('file refs cannot probe outside approved source roots', async () => {
		const priorRoots = process.env.FALCON_DASH_SOURCE_ROOTS;
		try {
			process.env.FALCON_DASH_SOURCE_ROOTS = '/';
			expect(await resolveWork3SourceRef({ kind: 'file', ref: '/etc/passwd' })).toEqual({
				available: false,
				reason: 'outside_approved_source_roots'
			});
		} finally {
			if (priorRoots === undefined) delete process.env.FALCON_DASH_SOURCE_ROOTS;
			else process.env.FALCON_DASH_SOURCE_ROOTS = priorRoots;
		}
	});

	it('rejects approved source roots that canonicalize to the filesystem root', async () => {
		const priorRoots = process.env.FALCON_DASH_SOURCE_ROOTS;
		const rootLink = join(fileDir, 'root-link');
		try {
			symlinkSync('/', rootLink);
			process.env.FALCON_DASH_SOURCE_ROOTS = rootLink;
			expect(await resolveWork3SourceRef({ kind: 'file', ref: '/etc/passwd' })).toEqual({
				available: false,
				reason: 'outside_approved_source_roots'
			});
		} finally {
			if (priorRoots === undefined) delete process.env.FALCON_DASH_SOURCE_ROOTS;
			else process.env.FALCON_DASH_SOURCE_ROOTS = priorRoots;
		}
	});

	it('allows configured source roots through their symlink spelling', async () => {
		const priorRoots = process.env.FALCON_DASH_SOURCE_ROOTS;
		const externalDir = mkdtempSync(join(tmpdir(), 'falcon-source-target-'));
		const linkParent = mkdtempSync(join(tmpdir(), 'falcon-source-link-'));
		const sourceLink = join(linkParent, 'evidence');
		try {
			symlinkSync(externalDir, sourceLink);
			writeFileSync(join(externalDir, 'proof.txt'), 'proof');
			process.env.FALCON_DASH_SOURCE_ROOTS = sourceLink;
			expect(
				await resolveWork3SourceRef({ kind: 'file', ref: join(sourceLink, 'proof.txt') })
			).toEqual({ available: true });
		} finally {
			if (priorRoots === undefined) delete process.env.FALCON_DASH_SOURCE_ROOTS;
			else process.env.FALCON_DASH_SOURCE_ROOTS = priorRoots;
			rmSync(linkParent, { recursive: true, force: true });
			rmSync(externalDir, { recursive: true, force: true });
		}
	});

	it('URL refs reject unsafe protocols and private destinations without fetching', async () => {
		const headRequest = vi.fn();
		setSourceUrlHeadRequestForTests(headRequest);

		await expect(
			resolveWork3SourceRef({ kind: 'url', ref: 'file:///etc/passwd' })
		).resolves.toEqual({
			available: false,
			reason: 'unsupported_url_protocol'
		});
		await expect(
			resolveWork3SourceRef({ kind: 'url', ref: 'http://127.0.0.1:3000' })
		).resolves.toEqual({
			available: false,
			reason: 'private_url_destination'
		});
		await expect(resolveWork3SourceRef({ kind: 'url', ref: 'http://[::1]/' })).resolves.toEqual({
			available: false,
			reason: 'private_url_destination'
		});
		for (const ref of [
			'http://[::ffff:7f00:1]/',
			'http://[::ffff:a9fe:a9fe]/',
			'http://[fec0::1]/',
			'http://[64:ff9b::7f00:1]/',
			'http://[2002:7f00:1::]/'
		]) {
			await expect(resolveWork3SourceRef({ kind: 'url', ref })).resolves.toEqual({
				available: false,
				reason: 'private_url_destination'
			});
		}
		expect(headRequest).not.toHaveBeenCalled();
	});

	it('revalidates redirect destinations before following them', async () => {
		const headRequest = vi.fn().mockResolvedValue({
			status: 302,
			location: 'http://169.254.169.254/latest/meta-data/'
		});
		setSourceUrlHeadRequestForTests(headRequest);

		await expect(
			resolveWork3SourceRef({ kind: 'url', ref: 'https://93.184.216.34/source' })
		).resolves.toEqual({
			available: false,
			reason: 'private_url_destination'
		});
		expect(headRequest).toHaveBeenCalledTimes(1);
	});

	it('reports DNS failures as unreachable rather than private destinations', async () => {
		await expect(
			resolveWork3SourceRef({ kind: 'url', ref: 'https://source-does-not-exist.invalid/proof' })
		).resolves.toEqual({
			available: false,
			reason: 'unreachable'
		});
	});

	it('aborts an in-flight URL probe when its display batch reaches the deadline', async () => {
		let aborted = false;
		setSourceUrlHeadRequestForTests(
			(_target, signal) =>
				new Promise((_resolveRequest, rejectRequest) => {
					signal?.addEventListener(
						'abort',
						() => {
							aborted = true;
							rejectRequest(new Error('aborted'));
						},
						{ once: true }
					);
				})
		);

		const result = await resolveWork3SourceRefs(
			[{ kind: 'url', ref: 'https://93.184.216.34/proof' }],
			{ deadlineMs: 60 }
		);

		expect(aborted).toBe(true);
		expect(result.resolutions).toEqual([{ available: false, reason: 'resolution_timeout' }]);
	});

	it('resolves display batches with bounded concurrency and reports omissions', async () => {
		let active = 0;
		let maxActive = 0;
		setSourceKindResolver('bounded-test', async () => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 2));
			active -= 1;
			return { available: true };
		});
		const refs = Array.from({ length: MAX_SOURCE_REFS + 5 }, (_, index) => ({
			kind: 'bounded-test',
			ref: `source-${index}`
		}));
		const result = await resolveWork3SourceRefs(refs, { concurrency: 3 });

		expect(result.resolutions).toHaveLength(MAX_SOURCE_REFS);
		expect(result.omitted).toBe(5);
		expect(maxActive).toBeLessThanOrEqual(3);
	});

	it('returns timeout states when a display batch exceeds its deadline', async () => {
		setSourceKindResolver('never-resolves', () => new Promise<never>(() => undefined));
		const refs = Array.from({ length: 10 }, (_, index) => ({
			kind: 'never-resolves',
			ref: `source-${index}`
		}));
		const startedAt = Date.now();
		const result = await resolveWork3SourceRefs(refs, {
			concurrency: 2,
			deadlineMs: 60
		});

		expect(Date.now() - startedAt).toBeLessThan(250);
		expect(result.resolutions).toHaveLength(10);
		expect(
			result.resolutions.every((resolution) => resolution.reason === 'resolution_timeout')
		).toBe(true);
	});

	it('evicts least-recently-used display resolutions when the cache is full', async () => {
		let resolutions = 0;
		setSourceKindResolver('cache-test', async () => {
			resolutions += 1;
			return { available: true };
		});
		const refs = Array.from({ length: 300 }, (_, index) => ({
			kind: 'cache-test',
			ref: `source-${index}`
		}));
		for (let offset = 0; offset < refs.length; offset += MAX_SOURCE_REFS) {
			await resolveWork3SourceRefs(refs.slice(offset, offset + MAX_SOURCE_REFS));
		}
		expect(resolutions).toBe(300);

		await resolveWork3SourceRefs([refs[0]]);
		expect(resolutions).toBe(301);
	});

	it('work_event refs resolve against the Event Log', async () => {
		registerCommand({
			name: 'note_source_test',
			targetType: null,
			summary: 'x',
			requiresTarget: false,
			execute: (ctx) => {
				const id = allocateEntityId(ctx.db, 'finding');
				insertEntity(ctx.db, { id, type: 'finding', now: ctx.now });
				return {
					result: { id },
					events: [{ event_type: 'noted', subject_type: 'finding', subject_id: id, summary: 'x' }]
				};
			}
		});
		const result = await executeCommand({
			command: 'note_source_test',
			actor: { kind: 'system', id: 't', label: 'T' }
		});
		transferWork3OutboxOnce();
		const eventId = result.events[0].id;
		expect(await resolveWork3SourceRef({ kind: 'work_event', ref: eventId })).toEqual({
			available: true
		});
		expect(await resolveWork3SourceRef({ kind: 'work_event', ref: '01UNKNOWN' })).toMatchObject({
			available: false
		});
	});

	it('message refs report gateway_unreachable when the gateway is down — never silently available', async () => {
		const result = await resolveWork3SourceRef({ kind: 'message', ref: 'agent:main:main#msg-1' });
		expect(result.available).toBe(false);
		expect(result.reason).toContain('gateway');
	});

	it('malformed message refs are unavailable with a reason', async () => {
		const result = await resolveWork3SourceRef({ kind: 'message', ref: 'no-message-id-here' });
		expect(result).toMatchObject({ available: false });
		expect(result.reason).toContain('malformed');
	});

	it('human statements need a label quoting the statement', async () => {
		expect(
			await resolveWork3SourceRef({ kind: 'human_statement', ref: 'standup-2026-07-22' })
		).toMatchObject({ available: false });
		expect(
			await resolveWork3SourceRef({
				kind: 'human_statement',
				ref: 'standup-2026-07-22',
				label: 'Fred: ship it this week'
			})
		).toEqual({ available: true });
	});

	it('unverifiable kinds are honest: never reported available', async () => {
		expect(await resolveWork3SourceRef({ kind: 'carrier_pigeon', ref: 'coop-7' })).toEqual({
			available: false,
			reason: 'unverifiable_kind:carrier_pigeon'
		});
	});

	it('kind resolvers are injectable (deployment/test hook)', async () => {
		setSourceKindResolver('commit', async (ref) => ({ available: ref.ref.startsWith('abc') }));
		expect(await resolveWork3SourceRef({ kind: 'commit', ref: 'abc123' })).toEqual({
			available: true
		});
		expect(await resolveWork3SourceRef({ kind: 'commit', ref: 'def456' })).toEqual({
			available: false
		});
	});
});
