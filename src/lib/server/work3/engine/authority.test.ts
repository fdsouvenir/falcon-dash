// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	allocateEntityId,
	executeCommand,
	getWork3Db,
	humanAuthorityPreGuard,
	insertEntity,
	registerCommand,
	setAuthoritySourceResolver
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Human-authority-basis guard (#334 release-gate evidence, gate 1/2): person
 * sessions are their own authority basis; agents must carry a resolvable
 * human-instruction source_ref; system actors are always rejected.
 */

let context: Work3TestContext;

const person: Actor = { kind: 'person', id: 'fred', label: 'Fred' };
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };
const system: Actor = { kind: 'system', id: 'reconciler', label: 'Reconciler' };

let targetId: string;

beforeEach(() => {
	context = setupWork3TestDbs();
	const db = getWork3Db();
	targetId = allocateEntityId(db, 'decision');
	insertEntity(db, { id: targetId, type: 'decision', now: Date.now() });

	registerCommand({
		name: 'test_authority_act',
		targetType: 'decision',
		summary: 'Synthetic authority-creating command',
		requiresTarget: true,
		preGuards: [humanAuthorityPreGuard],
		execute: (ctx) => ({
			result: { decided: true },
			events: [
				{
					event_type: 'test_decided',
					subject_type: 'decision',
					subject_id: ctx.targetId!,
					summary: 'Decided'
				}
			]
		})
	});
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('human authority basis', () => {
	it('accepts a person actor without any source_ref (session is the basis)', async () => {
		const result = await executeCommand({
			command: 'test_authority_act',
			actor: person,
			target: targetId,
			expected_version: 1
		});
		expect(result.ok).toBe(true);
		expect(result.events[0].actor).toEqual(person);
	});

	it('rejects an agent without authority_source', async () => {
		await expect(
			executeCommand({
				command: 'test_authority_act',
				actor: agent,
				target: targetId,
				expected_version: 1
			})
		).rejects.toMatchObject({ code: 'authority_required' });
	});

	it('rejects malformed and wrong-kind authority sources', async () => {
		await expect(
			executeCommand({
				command: 'test_authority_act',
				actor: agent,
				target: targetId,
				expected_version: 1,
				payload: { authority_source: { kind: 'commit', ref: 'abc123' } }
			})
		).rejects.toMatchObject({ code: 'authority_required' });

		await expect(
			executeCommand({
				command: 'test_authority_act',
				actor: agent,
				target: targetId,
				expected_version: 1,
				payload: { authority_source: { kind: 'message', ref: '   ' } }
			})
		).rejects.toMatchObject({ code: 'authority_required' });
	});

	it('accepts an agent with a resolvable human-instruction source_ref and records both identities', async () => {
		const result = await executeCommand({
			command: 'test_authority_act',
			actor: agent,
			target: targetId,
			expected_version: 1,
			payload: {
				authority_source: {
					kind: 'message',
					ref: 'gateway:session/abc:msg/42',
					summary: 'Fred: yes, go ahead'
				}
			}
		});
		expect(result.ok).toBe(true);
		// Executing actor is the agent; the claimed human basis rides in the payload.
		expect(result.events[0].actor).toEqual(agent);
	});

	it('rejects an agent whose source_ref does not resolve', async () => {
		setAuthoritySourceResolver(async () => false);
		await expect(
			executeCommand({
				command: 'test_authority_act',
				actor: agent,
				target: targetId,
				expected_version: 1,
				payload: { authority_source: { kind: 'message', ref: 'gateway:bogus' } }
			})
		).rejects.toMatchObject({ code: 'authority_required' });
	});

	it('always rejects system actors', async () => {
		await expect(
			executeCommand({
				command: 'test_authority_act',
				actor: system,
				target: targetId,
				expected_version: 1,
				payload: { authority_source: { kind: 'message', ref: 'gateway:x' } }
			})
		).rejects.toMatchObject({ code: 'authority_required' });
	});
});
