// @vitest-environment node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSourceRef, parseSourceRefs } from '$lib/work3-shared/sources.js';
import {
	allocateEntityId,
	executeCommand,
	insertEntity,
	registerCommand,
	resolveWork3SourceRef,
	setSourceKindResolver,
	transferWork3OutboxOnce
} from './index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from './testing.js';

/**
 * Source-ref schema + resolution (#337 release-gate evidence): shape
 * validation, per-kind resolution, and the explicit unavailable state.
 */

let context: Work3TestContext;
let fileDir: string;

beforeEach(() => {
	context = setupWork3TestDbs();
	fileDir = mkdtempSync(join(tmpdir(), 'falcon-sources-'));
});

afterEach(() => {
	teardownWork3TestDbs(context);
	rmSync(fileDir, { recursive: true, force: true });
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
	});

	it('enforces required-ness for source_refs arrays', () => {
		expect(() => parseSourceRefs(undefined, { required: true })).toThrow();
		expect(() => parseSourceRefs([], { required: true })).toThrow();
		expect(parseSourceRefs(undefined)).toEqual([]);
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
