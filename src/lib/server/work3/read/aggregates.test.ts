// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	computeBrief,
	computeQueue,
	executeCommand,
	getWork3Db,
	loadEntity,
	materialRecentChanges,
	registerWork3Objects,
	searchWork,
	setCronGatewayForTests,
	transferWork3OutboxOnce
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Aggregate-query tests (#341 release-gate evidence, gate 1 AXI portion):
 * server-computed buckets with totals + bounded rows (no N+1), bounded
 * session brief, material feed with unconditional authority acts, FTS search
 * with loud unknown-input failures.
 */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

let areaId: string;

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

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	setCronGatewayForTests({
		list: async () => [],
		get: async () => null,
		add: async () => {
			throw new Error('unused');
		},
		update: async () => {
			throw new Error('unused');
		},
		remove: async () => {},
		runs: async () => []
	});
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
});

afterEach(() => {
	setCronGatewayForTests(null);
	teardownWork3TestDbs(context);
});

describe('queue buckets', () => {
	it('classifies work into the required buckets with totals and bounded rows', async () => {
		// Actionable: a ready task.
		const ready = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Ready work'
		});
		await cmd('ready_task', ready.result.id, { owner: 'agent:main' });

		// Needs Fred: an open question and a pending decision.
		await cmd('create_question', undefined, {
			area_id: areaId,
			question: 'Which host?',
			impact: 'Blocks deploy'
		});
		await cmd('create_decision', undefined, {
			area_id: areaId,
			title: 'Pick host',
			prompt: 'Which host?',
			consequence_of_no_decision: 'Deploy stalls',
			deciders: ['fred'],
			options: [
				{ id: 'a', label: 'Hetzner' },
				{ id: 'b', label: 'Fly' }
			],
			recommendation: { option_id: 'a' }
		});

		// Waiting split: agent vs external.
		const waitingAgent = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Agent wait'
		});
		await cmd('ready_task', waitingAgent.result.id, { owner: 'agent:main' });
		await cmd('wait_task', waitingAgent.result.id, {
			waiting_on: 'agent:sidekick',
			reason: 'Handoff',
			resume_condition: 'Sidekick replies'
		});
		const waitingVendor = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Vendor wait'
		});
		await cmd('ready_task', waitingVendor.result.id, { owner: 'agent:main' });
		await cmd('wait_task', waitingVendor.result.id, {
			waiting_on: 'vendor-support',
			reason: 'Ticket open',
			resume_condition: 'Ticket resolved'
		});

		// Blocked: a blocked task.
		const blocked = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Blocked work'
		});
		await cmd('create_blocker', undefined, {
			blocked_id: blocked.result.id,
			source_kind: 'external',
			source_label: 'Vendor',
			reason: 'Access pending',
			resolution_condition: 'Access granted'
		});

		const queue = await computeQueue();
		expect(queue.actionable_now.total).toBe(1);
		expect(queue.actionable_now.items[0]).toMatchObject({ id: ready.result.id });
		expect(queue.needs_fred.total).toBe(2);
		expect(queue.waiting_on_agent.total).toBe(1);
		expect(queue.waiting_on_external.total).toBe(1);
		expect(queue.blocked_risk.total).toBe(1);
		expect(queue.blocked_risk.items[0]).toMatchObject({
			id: blocked.result.id,
			why: 'Access pending'
		});
		// Blocked work is not actionable.
		expect(queue.actionable_now.items.some((item) => item.id === blocked.result.id)).toBe(false);
	});

	it('bounds bucket rows while reporting the full total', async () => {
		for (let index = 0; index < 12; index++) {
			const task = await cmd<{ id: string }>('create_task', undefined, {
				area_id: areaId,
				title: `Task ${index}`
			});
			await cmd('ready_task', task.result.id, { owner: 'agent:main' });
		}
		const queue = await computeQueue();
		expect(queue.actionable_now.total).toBe(12);
		expect(queue.actionable_now.items.length).toBeLessThanOrEqual(8);
	});

	it('surfaces reconciliation problems: active projects without a next item', async () => {
		const project = await cmd<{ id: string }>('create_project', undefined, {
			area_id: areaId,
			title: 'P',
			desired_outcome: 'Done',
			scope_included: ['x'],
			owner: 'agent:main',
			completion_criteria: ['works']
		});
		await cmd('plan_project', project.result.id);
		await cmd('activate_project', project.result.id, { plan_not_required_reason: 'small' });
		const queue = await computeQueue();
		expect(queue.needs_reconciliation.items.some((item) => item.id === project.result.id)).toBe(
			true
		);
	});

	it('reports gateway unavailability inside the automata bucket instead of failing the queue', async () => {
		setCronGatewayForTests({
			list: async () => {
				throw new Error('gateway down');
			},
			get: async () => null,
			add: async () => {
				throw new Error('x');
			},
			update: async () => {
				throw new Error('x');
			},
			remove: async () => {},
			runs: async () => []
		});
		const queue = await computeQueue();
		expect(queue.unhealthy_automata.items[0]).toMatchObject({
			title: 'OpenClaw runtime unreachable'
		});
	});
});

describe('brief and material feed', () => {
	it('brief is bounded and includes exact deeper commands', async () => {
		for (let index = 0; index < 9; index++) {
			const task = await cmd<{ id: string }>('create_task', undefined, {
				area_id: areaId,
				title: `T${index}`
			});
			await cmd('ready_task', task.result.id, { owner: 'agent:main' });
		}
		const brief = (await computeBrief()) as Record<string, { total: number; items: unknown[] }> & {
			help: string[];
		};
		expect(brief.actionable_now.total).toBe(9);
		expect(brief.actionable_now.items.length).toBeLessThanOrEqual(5);
		expect(brief.help.some((line) => line.includes('falcon queue'))).toBe(true);
	});

	it('authority acts appear unconditionally in the material feed with their sources', async () => {
		const decision = await cmd<{ id: string }>('create_decision', undefined, {
			area_id: areaId,
			title: 'D',
			prompt: 'Which?',
			consequence_of_no_decision: 'stall',
			deciders: ['fred'],
			options: [
				{ id: 'a', label: 'A' },
				{ id: 'b', label: 'B' }
			],
			recommendation: { option_id: 'a' }
		});
		await cmd(
			'decide',
			decision.result.id,
			{
				option_id: 'a',
				rationale: 'Fred said so',
				authority_source: { kind: 'human_statement', ref: 'standup', label: 'Fred: go with A' }
			},
			agent
		);
		transferWork3OutboxOnce();
		const feed = materialRecentChanges(20);
		const act = feed.find((entry) => entry.event === 'decision_decided');
		expect(act).toBeDefined();
		expect(act!.authority_act).toBe(true);
		expect(act!.authority_sources).toEqual([
			expect.objectContaining({ kind: 'human_statement', ref: 'standup' })
		]);
	});
});

describe('FTS search', () => {
	it('finds work across types and updates on edit', async () => {
		const task = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Rotate the flux capacitor',
			summary: 'Yearly maintenance'
		});
		await cmd('create_question', undefined, {
			area_id: areaId,
			question: 'Is the flux capacitor safe?'
		});

		let results = searchWork('flux capacitor');
		expect(results.length).toBe(2);
		expect(results.map((row) => row.type).sort()).toEqual(['question', 'task']);

		results = searchWork('flux', { type: 'task' });
		expect(results).toEqual([expect.objectContaining({ id: task.result.id })]);

		await cmd('update_task', task.result.id, { title: 'Recalibrate the warp core' });
		expect(searchWork('warp core').length).toBe(1);
		expect(searchWork('flux', { type: 'task' }).length).toBe(0);
	});

	it('fails loudly on unknown types and empty queries; empty results are definitive', () => {
		expect(() => searchWork('x', { type: 'widget' })).toThrowError(
			expect.objectContaining({ code: 'validation_failed' })
		);
		expect(() => searchWork('   ')).toThrowError(
			expect.objectContaining({ code: 'validation_failed' })
		);
		expect(searchWork('nonexistent-term-zzz')).toEqual([]);
	});
});
