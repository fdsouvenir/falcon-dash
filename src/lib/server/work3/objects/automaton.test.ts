// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Work3Error } from '$lib/work3-shared/errors.js';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	executeCommand,
	getWork3Db,
	loadAutomatonAttrs,
	loadEntity,
	registerWork3Objects,
	setCronGatewayForTests,
	syncAutomatonsOnce,
	type CronGatewayApi,
	type CronJob,
	type CronRun
} from '../index.js';
import { getObjectReader } from '../read/registry.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * OpenClaw integration tests (#340 release-gate evidence, gate 4): one
 * aggregate identity, direct-edit reflection, pause/activate/delete/restore,
 * runtime failure reporting, read-through Runs with no Falcon Run artifact.
 * Runs against a faithful fake of the verified 2026.7.1-2 cron RPC surface.
 */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };

/** In-memory fake of the gateway cron store. */
class FakeCronRuntime implements CronGatewayApi {
	jobs = new Map<string, CronJob>();
	runsByJob = new Map<string, CronRun[]>();
	nextId = 1;
	failNextCall: string | null = null;

	private maybeFail(op: string): void {
		if (this.failNextCall === op || this.failNextCall === '*') {
			this.failNextCall = null;
			throw new Work3Error('runtime_unavailable', `fake gateway: ${op} failed`);
		}
	}

	async list(): Promise<CronJob[]> {
		this.maybeFail('list');
		return [...this.jobs.values()];
	}
	async get(id: string): Promise<CronJob | null> {
		this.maybeFail('get');
		return this.jobs.get(id) ?? null;
	}
	async add(params: Record<string, unknown>): Promise<CronJob> {
		this.maybeFail('add');
		const job: CronJob = {
			id: `job-${this.nextId++}`,
			name: params.name as string,
			description: params.description as string | undefined,
			enabled: params.enabled === true,
			schedule: params.schedule as Record<string, unknown>,
			payload: params.payload as Record<string, unknown>,
			sessionTarget: (params.sessionTarget as string) ?? 'isolated',
			wakeMode: (params.wakeMode as string) ?? 'next-heartbeat',
			...(params.agentId ? { agentId: params.agentId as string } : {}),
			...(params.delivery ? { delivery: params.delivery as Record<string, unknown> } : {}),
			createdAtMs: Date.now(),
			updatedAtMs: Date.now()
		};
		this.jobs.set(job.id, job);
		return job;
	}
	async update(id: string, patch: Record<string, unknown>): Promise<CronJob> {
		this.maybeFail('update');
		const job = this.jobs.get(id);
		if (!job) throw new Work3Error('runtime_unavailable', `unknown cron job id: ${id}`);
		const updated = { ...job, ...patch, updatedAtMs: job.updatedAtMs + 1 } as CronJob;
		this.jobs.set(id, updated);
		return updated;
	}
	async remove(id: string): Promise<void> {
		this.maybeFail('remove');
		this.jobs.delete(id);
	}
	async runs(id: string): Promise<CronRun[]> {
		this.maybeFail('runs');
		return this.runsByJob.get(id) ?? [];
	}
}

let runtime: FakeCronRuntime;

async function cmd<T = Record<string, unknown>>(
	command: string,
	payload: Record<string, unknown> = {}
) {
	return executeCommand<T>({ command, actor: agent, payload });
}

function createPayload(overrides: Record<string, unknown> = {}) {
	return {
		name: 'Nightly digest',
		schedule: { kind: 'cron', expr: '0 6 * * *' },
		payload: { kind: 'systemEvent', text: 'Send the digest' },
		summary: 'Sends the morning digest',
		...overrides
	};
}

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	runtime = new FakeCronRuntime();
	setCronGatewayForTests(runtime);
	await executeCommand({ command: 'create_area', actor: agent, payload: { title: 'Ops' } });
});

afterEach(() => {
	setCronGatewayForTests(null);
	teardownWork3TestDbs(context);
});

describe('one-aggregate identity', () => {
	it('the OpenClaw job id IS the Automaton identity — no separate Falcon id', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload({ area_id: 'a1' }));
		const id = created.result.id;
		expect(runtime.jobs.has(id)).toBe(true);
		// The entities row reuses the runtime id.
		expect(loadEntity(getWork3Db(), id)).toMatchObject({ id, type: 'automaton' });
		expect(loadAutomatonAttrs(getWork3Db(), id)?.job_id).toBe(id);
	});

	it('creates paused by default (doc 02)', async () => {
		const created = await cmd<{ id: string; lifecycle: string }>(
			'create_automaton',
			createPayload()
		);
		expect(created.result.lifecycle).toBe('paused');
		expect(runtime.jobs.get(created.result.id)?.enabled).toBe(false);
	});

	it('the read composes the LIVE record plus Falcon attributes', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		const item = (await getObjectReader('automaton').get(created.result.id, {
			view: 'detail',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(item).toMatchObject({
			id: created.result.id,
			name: 'Nightly digest',
			lifecycle: 'paused',
			summary: 'Sends the morning digest'
		});
	});
});

describe('direct OpenClaw edits (no drift semantics)', () => {
	it('direct runtime edits appear on read-through with no sync step', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		// Someone renames + enables the job directly in OpenClaw.
		await runtime.update(created.result.id, { name: 'Renamed directly', enabled: true });
		const item = (await getObjectReader('automaton').get(created.result.id, {
			view: 'list',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(item).toMatchObject({ name: 'Renamed directly', lifecycle: 'active' });
	});

	it('directly created jobs appear automatically as Automatons with sparse attributes', async () => {
		await runtime.add({
			name: 'Made in OpenClaw',
			schedule: { kind: 'every', everyMs: 60000 },
			payload: { kind: 'systemEvent', text: 'hi' },
			sessionTarget: 'main',
			wakeMode: 'now',
			enabled: true
		});
		const listing = await getObjectReader('automaton').list({
			view: 'list',
			filters: {},
			limit: 50,
			offset: 0
		});
		expect(listing.items.some((item) => item.name === 'Made in OpenClaw')).toBe(true);
	});

	it('direct deletion is detected by sync; the restoration snapshot survives', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		runtime.jobs.delete(created.result.id); // deleted directly in OpenClaw
		const result = await syncAutomatonsOnce();
		expect(result.newly_deleted).toContain(created.result.id);
		const attrs = loadAutomatonAttrs(getWork3Db(), created.result.id)!;
		expect(attrs.deleted_at).not.toBeNull();
		expect(attrs.deletion_source).toBe('openclaw');
		expect(attrs.deletion_snapshot ?? attrs.last_seen_runtime_config).not.toBeNull();
	});
});

describe('lifecycle over the aggregate', () => {
	it('activate/pause mutate OpenClaw enabled state directly and are idempotent', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		const id = created.result.id;

		await cmd('activate_automaton', { id });
		expect(runtime.jobs.get(id)?.enabled).toBe(true);
		const repeat = await cmd('activate_automaton', { id });
		expect(repeat.noop).toBe(true);

		await cmd('pause_automaton', { id });
		expect(runtime.jobs.get(id)?.enabled).toBe(false);
		expect((await cmd('pause_automaton', { id })).noop).toBe(true);
	});

	it('update patches the same OpenClaw object with concurrency protection', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		const id = created.result.id;
		const staleMs = runtime.jobs.get(id)!.updatedAtMs;

		await cmd('update_automaton', { id, patch: { name: 'Renamed via Falcon' } });
		expect(runtime.jobs.get(id)?.name).toBe('Renamed via Falcon');

		await expect(
			cmd('update_automaton', {
				id,
				patch: { name: 'Stale write' },
				expected_runtime_updated_at_ms: staleMs
			})
		).rejects.toMatchObject({ code: 'version_conflict' });
		expect(runtime.jobs.get(id)?.name).toBe('Renamed via Falcon');
	});

	it('delete preserves the snapshot; restore recreates paused with lineage and a new id', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		const id = created.result.id;
		await cmd('activate_automaton', { id });

		const deleted = await cmd<{ restorable: boolean }>('delete_automaton', { id });
		expect(deleted.result.restorable).toBe(true);
		expect(runtime.jobs.has(id)).toBe(false);
		expect(loadAutomatonAttrs(getWork3Db(), id)?.deletion_source).toBe('falcon');

		const restored = await cmd<{ id: string; lifecycle: string; restored_from: string }>(
			'restore_automaton',
			{ id }
		);
		expect(restored.result.lifecycle).toBe('paused');
		expect(restored.result.restored_from).toBe(id);
		expect(restored.result.id).not.toBe(id); // restore produces a new runtime id
		const newJob = runtime.jobs.get(restored.result.id)!;
		expect(newJob).toMatchObject({ name: 'Nightly digest', enabled: false });
		// Attributes re-bound with lineage.
		expect(loadAutomatonAttrs(getWork3Db(), restored.result.id)).toMatchObject({
			summary: 'Sends the morning digest',
			restored_from: id
		});
	});

	it('restore requires a deleted Automaton with a snapshot', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		await expect(cmd('restore_automaton', { id: created.result.id })).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});
	});
});

describe('runtime failure reporting (gate 6 partial)', () => {
	it('a failed gateway operation surfaces as runtime_unavailable, never a fake lifecycle state', async () => {
		runtime.failNextCall = 'add';
		await expect(cmd('create_automaton', createPayload())).rejects.toMatchObject({
			code: 'runtime_unavailable'
		});
		// Nothing was half-created locally.
		const rows = getWork3Db().prepare('SELECT COUNT(*) AS count FROM automaton_attrs').get() as {
			count: number;
		};
		expect(rows.count).toBe(0);

		// Recovery: the same command succeeds when the runtime is healthy again.
		const retried = await cmd<{ id: string }>('create_automaton', createPayload());
		expect(retried.result.id).toBeDefined();
	});

	it('update failures leave both sides consistent and recoverable', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		runtime.failNextCall = 'update';
		await expect(
			cmd('update_automaton', { id: created.result.id, patch: { name: 'Will fail' } })
		).rejects.toMatchObject({ code: 'runtime_unavailable' });
		expect(runtime.jobs.get(created.result.id)?.name).toBe('Nightly digest');
		await cmd('update_automaton', { id: created.result.id, patch: { name: 'Recovered' } });
		expect(runtime.jobs.get(created.result.id)?.name).toBe('Recovered');
	});

	it('an unreachable runtime is a health state on reads of known Automatons', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		runtime.jobs.delete(created.result.id);
		const item = (await getObjectReader('automaton').get(created.result.id, {
			view: 'detail',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		// Not deleted via any command: health reports unreachable, lifecycle is
		// not silently rewritten to a terminal state.
		expect(item.health).toBe('unreachable');
	});
});

describe('read-through native Runs (no Falcon Run artifact)', () => {
	it('full view surfaces cron.runs directly; nothing is copied into Falcon tables', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		runtime.runsByJob.set(created.result.id, [
			{ ts: 1, jobId: created.result.id, status: 'ok', summary: 'ran fine' },
			{ ts: 2, jobId: created.result.id, status: 'error', error: 'boom' }
		]);
		const item = (await getObjectReader('automaton').get(created.result.id, {
			view: 'full',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(item.runs).toHaveLength(2);
		// No Falcon Run storage exists at all.
		const tables = getWork3Db()
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%run%'`)
			.all() as Array<{ name: string }>;
		expect(tables).toEqual([]);
	});

	it('failing last runs surface as health, not lifecycle', async () => {
		const created = await cmd<{ id: string }>('create_automaton', createPayload());
		await cmd('activate_automaton', { id: created.result.id });
		const job = runtime.jobs.get(created.result.id)!;
		runtime.jobs.set(created.result.id, {
			...job,
			lastRunStatus: 'error',
			lastRunError: 'model overloaded'
		});
		const item = (await getObjectReader('automaton').get(created.result.id, {
			view: 'list',
			filters: {},
			limit: 1,
			offset: 0
		}))!;
		expect(item).toMatchObject({ lifecycle: 'active', health: 'failing' });
	});
});
