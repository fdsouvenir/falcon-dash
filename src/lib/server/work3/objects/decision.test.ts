// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import { setAuthoritySourceResolver } from '../engine/authority.js';
import {
	currentPackage,
	executeCommand,
	getWork3Db,
	loadDecision,
	loadEntity,
	packageHistory,
	registerWork3Objects
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Decision contract tests (template §1–7): decision-ready creation, immutable
 * packages/outcomes, authority basis on decide, supersession chains.
 */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };
const person: Actor = { kind: 'person', id: 'fred', label: 'Fred' };

let areaId: string;

const AUTHORITY = {
	authority_source: {
		kind: 'message',
		ref: 'agent:main:main#msg-42',
		label: 'Fred: go with GitHub Packages'
	}
};

function packagePayload(overrides: Record<string, unknown> = {}) {
	return {
		area_id: areaId,
		title: 'Choose the package registry',
		prompt: 'Which registry should falcon-dash publish to?',
		consequence_of_no_decision: 'Release pipeline stays blocked',
		deciders: ['fred'],
		options: [
			{ id: 'npm', label: 'Public npm', summary: 'Simple, public' },
			{ id: 'ghp', label: 'GitHub Packages', summary: 'Private, integrated' }
		],
		recommendation: { option_id: 'ghp', rationale: 'Already used by fredbot hosting' },
		...overrides
	};
}

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {},
	actor: Actor = agent
) {
	return executeCommand<T>({
		command,
		actor,
		target: target ?? null,
		expected_version: target ? loadEntity(getWork3Db(), target)!.version : undefined,
		payload
	});
}

async function createDecision(): Promise<string> {
	return (await cmd<{ id: string }>('create_decision', undefined, packagePayload())).result.id;
}

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('create_decision (decision-ready)', () => {
	it('creates directly as pending with the full package', async () => {
		const id = await createDecision();
		expect(loadDecision(getWork3Db(), id)).toMatchObject({ status: 'pending' });
		const pkg = currentPackage(getWork3Db(), id)!;
		expect(JSON.parse(pkg.options)).toHaveLength(2);
	});

	it('requires at least two materially distinct options', async () => {
		await expect(
			cmd(
				'create_decision',
				undefined,
				packagePayload({ options: [{ id: 'a', label: 'Only one' }] })
			)
		).rejects.toMatchObject({ code: 'validation_failed' });
		await expect(
			cmd(
				'create_decision',
				undefined,
				packagePayload({
					options: [
						{ id: 'a', label: 'Same' },
						{ id: 'b', label: 'same' }
					]
				})
			)
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('requires the recommendation to reference a listed option', async () => {
		await expect(
			cmd('create_decision', undefined, packagePayload({ recommendation: { option_id: 'zzz' } }))
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('requires deciders and consequence', async () => {
		await expect(
			cmd('create_decision', undefined, packagePayload({ deciders: [] }))
		).rejects.toMatchObject({ code: 'validation_failed' });
		await expect(
			cmd('create_decision', undefined, packagePayload({ consequence_of_no_decision: '' }))
		).rejects.toMatchObject({ code: 'validation_failed' });
	});
});

describe('decide (authority-creating)', () => {
	it('rejects an agent without a human-instruction source_ref', async () => {
		const id = await createDecision();
		await expect(
			cmd('decide', id, { option_id: 'ghp', rationale: 'Best fit' })
		).rejects.toMatchObject({ code: 'authority_required' });
	});

	it('rejects an agent whose instruction ref does not resolve', async () => {
		setAuthoritySourceResolver(async () => false);
		const id = await createDecision();
		await expect(
			cmd('decide', id, { option_id: 'ghp', rationale: 'Best fit', ...AUTHORITY })
		).rejects.toMatchObject({ code: 'authority_required' });
	});

	it('records the outcome with executing actor and claimed authority basis', async () => {
		const id = await createDecision();
		const decided = await cmd('decide', id, {
			option_id: 'ghp',
			rationale: 'Fred said so',
			...AUTHORITY
		});
		expect(decided.result).toMatchObject({ status: 'decided', option_id: 'ghp' });
		const row = loadDecision(getWork3Db(), id)!;
		const outcome = JSON.parse(row.outcome!);
		expect(outcome.decided_by).toEqual(agent);
		expect(outcome.authority_basis).toMatchObject({
			kind: 'asserted_instruction',
			source_ref: { kind: 'message', ref: 'agent:main:main#msg-42' }
		});
		expect(decided.events[0].source_refs).toHaveLength(1);
	});

	it('person sessions decide without a source_ref; basis is the session', async () => {
		const id = await createDecision();
		await cmd('decide', id, { option_id: 'npm', rationale: 'Simplicity wins' }, person);
		const outcome = JSON.parse(loadDecision(getWork3Db(), id)!.outcome!);
		expect(outcome.authority_basis).toMatchObject({ kind: 'person_session' });
	});

	it('repeating the identical outcome is a no-op; a different outcome requires supersession', async () => {
		const id = await createDecision();
		await cmd('decide', id, { option_id: 'ghp', rationale: 'x', ...AUTHORITY });
		const repeat = await cmd('decide', id, { option_id: 'ghp', rationale: 'y', ...AUTHORITY });
		expect(repeat.noop).toBe(true);

		await expect(
			cmd('decide', id, { option_id: 'npm', rationale: 'changed my mind', ...AUTHORITY })
		).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['supersede_decision']
		});
	});

	it('rejects options not in the current package', async () => {
		const id = await createDecision();
		await expect(
			cmd('decide', id, { option_id: 'bogus', rationale: 'x', ...AUTHORITY })
		).rejects.toMatchObject({ code: 'validation_failed' });
	});
});

describe('defer / resume / withdraw / revise', () => {
	it('defers with a reason, resumes to pending, withdraws with a reason', async () => {
		const id = await createDecision();
		await cmd('defer_decision', id, { reason: 'Waiting on pricing info' });
		expect(loadDecision(getWork3Db(), id)?.status).toBe('deferred');

		await cmd('resume_decision', id);
		expect(loadDecision(getWork3Db(), id)?.status).toBe('pending');

		await cmd('withdraw_decision', id, { reason: 'Question dissolved the choice' });
		expect(loadDecision(getWork3Db(), id)?.status).toBe('withdrawn');
		await expect(
			cmd('decide', id, { option_id: 'ghp', rationale: 'x', ...AUTHORITY })
		).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});

	it('revise_decision creates a new immutable package revision on pending', async () => {
		const id = await createDecision();
		const first = currentPackage(getWork3Db(), id)!;
		await cmd('revise_decision', id, {
			...packagePayload({ title: 'Choose the registry (v2)' }),
			area_id: undefined
		});
		const history = packageHistory(getWork3Db(), id);
		expect(history).toHaveLength(2);
		expect(history[1].supersedes).toBe(first.id);
		expect(history[1].title).toBe('Choose the registry (v2)');
		expect(history[0].is_current).toBe(0);
	});

	it('decided packages cannot be revised', async () => {
		const id = await createDecision();
		await cmd('decide', id, { option_id: 'ghp', rationale: 'x', ...AUTHORITY });
		await expect(cmd('revise_decision', id, packagePayload())).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['supersede_decision']
		});
	});
});

describe('supersession chain', () => {
	it('supersedes a decided Decision with a new pending one, preserving the chain', async () => {
		const id = await createDecision();
		await cmd('decide', id, { option_id: 'ghp', rationale: 'x', ...AUTHORITY });

		const superseded = await cmd<{ superseded_by: string }>(
			'supersede_decision',
			id,
			packagePayload({ title: 'Revisit registry choice' })
		);
		const successor = superseded.result.superseded_by;
		expect(loadDecision(getWork3Db(), id)).toMatchObject({
			status: 'decided',
			superseded_by: successor
		});
		expect(loadDecision(getWork3Db(), successor)).toMatchObject({
			status: 'pending',
			supersedes_decision_id: id
		});
		// Historical commitment is never rewritten.
		expect(JSON.parse(loadDecision(getWork3Db(), id)!.outcome!).option_id).toBe('ghp');

		// Idempotent: superseding again returns the existing successor.
		const repeat = await cmd<{ superseded_by: string }>('supersede_decision', id, packagePayload());
		expect(repeat.noop).toBe(true);
		expect(repeat.result.superseded_by).toBe(successor);
	});

	it('only decided Decisions can be superseded', async () => {
		const id = await createDecision();
		await expect(cmd('supersede_decision', id, packagePayload())).rejects.toMatchObject({
			code: 'transition_not_allowed',
			alternatives: ['revise_decision']
		});
	});
});
