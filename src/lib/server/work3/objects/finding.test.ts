// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	executeCommand,
	getWork3Db,
	loadEntity,
	loadFinding,
	registerWork3Objects
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/** Finding contract tests (template §1–7): validity model, sources required. */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

let areaId: string;

const REF = [{ kind: 'file', ref: '/var/log/deploy.log', label: 'Deploy log' }];

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {}
) {
	return executeCommand<T>({
		command,
		actor: agent,
		target: target ?? null,
		expected_version: target ? loadEntity(getWork3Db(), target)!.version : undefined,
		payload
	});
}

function findingPayload(overrides: Record<string, unknown> = {}) {
	return {
		area_id: areaId,
		title: 'Deploys fail on cold starts',
		conclusion: 'The gateway restarts before the healthcheck passes',
		confidence: 'supported',
		source_refs: REF,
		...overrides
	};
}

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('create_finding', () => {
	it('records a current Finding with author and sources', async () => {
		const created = await cmd<{ id: string }>('create_finding', undefined, findingPayload());
		const row = loadFinding(getWork3Db(), created.result.id)!;
		expect(row).toMatchObject({ validity: 'current', author_id: 'main', confidence: 'supported' });
		expect(JSON.parse(row.source_refs)).toHaveLength(1);
	});

	it('requires source references — no sources, no Finding', async () => {
		await expect(
			cmd('create_finding', undefined, findingPayload({ source_refs: [] }))
		).rejects.toMatchObject({ code: 'validation_failed' });
		await expect(
			cmd('create_finding', undefined, findingPayload({ source_refs: undefined }))
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('validates attachment targets exist', async () => {
		await expect(
			cmd('create_finding', undefined, findingPayload({ targets: ['t999'] }))
		).rejects.toMatchObject({ code: 'not_found' });

		const task = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Fix healthcheck'
		});
		const created = await cmd<{ id: string }>(
			'create_finding',
			undefined,
			findingPayload({ targets: [task.result.id] })
		);
		expect(JSON.parse(loadFinding(getWork3Db(), created.result.id)!.targets)).toEqual([
			task.result.id
		]);
	});
});

describe('supersede_finding', () => {
	it('creates a linked replacement without rewriting the original', async () => {
		const original = (await cmd<{ id: string }>('create_finding', undefined, findingPayload()))
			.result.id;
		const superseded = await cmd<{ superseded_by: string }>(
			'supersede_finding',
			original,
			findingPayload({ title: 'Deploys fail on cold starts (corrected)', confidence: 'confirmed' })
		);
		const successor = superseded.result.superseded_by;
		expect(loadFinding(getWork3Db(), original)).toMatchObject({
			validity: 'superseded',
			superseded_by: successor,
			title: 'Deploys fail on cold starts'
		});
		expect(loadFinding(getWork3Db(), successor)).toMatchObject({
			validity: 'current',
			supersedes_finding_id: original
		});

		// Idempotent repeat returns the existing successor.
		const repeat = await cmd<{ superseded_by: string }>(
			'supersede_finding',
			original,
			findingPayload()
		);
		expect(repeat.noop).toBe(true);
		expect(repeat.result.superseded_by).toBe(successor);
	});
});

describe('retract_finding', () => {
	it('retracts with reason, actor, timestamp, and optional corrective sources', async () => {
		const id = (await cmd<{ id: string }>('create_finding', undefined, findingPayload())).result.id;
		const retracted = await cmd('retract_finding', id, {
			reason: 'Log analysis was wrong — different service',
			source_refs: [{ kind: 'file', ref: '/var/log/other.log', label: 'Correct log' }]
		});
		expect(retracted.events[0].actor).toEqual(agent);
		const row = loadFinding(getWork3Db(), id)!;
		expect(row.validity).toBe('retracted');
		expect(row.retracted_at).not.toBeNull();
		expect(JSON.parse(row.retract_source_refs)).toHaveLength(1);

		const repeat = await cmd('retract_finding', id, { reason: 'again' });
		expect(repeat.noop).toBe(true);
	});

	it('requires a reason; terminal Findings never return to current', async () => {
		const id = (await cmd<{ id: string }>('create_finding', undefined, findingPayload())).result.id;
		await expect(cmd('retract_finding', id)).rejects.toMatchObject({ code: 'validation_failed' });

		await cmd('retract_finding', id, { reason: 'wrong' });
		// A retracted Finding cannot be superseded (create a new one instead).
		await expect(cmd('supersede_finding', id, findingPayload())).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});
});
