import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { getWork3Db } from '../db.js';
import { loadEntity } from '../envelope.js';
import { registerCommand, type ExecuteContext, type PreGuardContext } from '../engine/registry.js';
import { optionalNumber, optionalString, requireString } from '../engine/validate.js';
import { getCronGateway, type CronJob } from '../cron-gateway.js';
import { loadArea } from './area.js';

/**
 * Automaton = one OpenClaw-backed aggregate (doc 01 correction, doc 06): the
 * live gateway cron record + automaton_attrs keyed by the SAME OpenClaw id.
 * The entities row reuses the OpenClaw job id — there is no separate Falcon
 * id. OpenClaw stays authoritative for runtime fields; Falcon stores only
 * extension attributes and the recoverable-deletion snapshot cache. No drift
 * semantics: direct OpenClaw edits simply appear on read-through.
 *
 * Cross-system executor shape: gateway RPC in the async pre-guard phase, then
 * the local transaction for extension attributes + outbox. Partial failure
 * surfaces as an operation/health error, never as a fake lifecycle state.
 */

export interface AutomatonAttrsRow {
	job_id: string;
	project_id: string | null;
	summary: string | null;
	policies: string;
	last_seen_runtime_config: string | null;
	last_seen_at: number | null;
	deleted_at: number | null;
	deletion_snapshot: string | null;
	deletion_source: string | null;
	restored_from: string | null;
	restored_at: number | null;
	created_at: number;
	updated_at: number;
}

export function loadAutomatonAttrs(db: Database.Database, jobId: string): AutomatonAttrsRow | null {
	return (
		(db
			.prepare('SELECT * FROM automaton_attrs WHERE job_id = ?')
			.get(jobId) as AutomatonAttrsRow) ?? null
	);
}

/** Runtime results computed in pre-guards, consumed inside the transaction. */
const runtimeResults = new WeakMap<
	Record<string, unknown>,
	{ job?: CronJob; snapshot?: CronJob; noop?: boolean }
>();

export function ensureAutomatonEntity(
	db: Database.Database,
	jobId: string,
	areaId: string | null,
	now: number
): void {
	if (!loadEntity(db, jobId)) {
		db.prepare(
			`INSERT INTO entities (id, type, area_id, created_at, updated_at, version) VALUES (?, 'automaton', ?, ?, ?, 1)`
		).run(jobId, areaId, now, now);
	}
}

/** Upsert the snapshot cache from a live job record (read-through refresh). */
export function recordRuntimeSnapshot(db: Database.Database, job: CronJob, now: number): void {
	ensureAutomatonEntity(db, job.id, null, now);
	const existing = loadAutomatonAttrs(db, job.id);
	if (existing) {
		db.prepare(
			`UPDATE automaton_attrs SET last_seen_runtime_config = ?, last_seen_at = ?, deleted_at = NULL,
			 deletion_snapshot = deletion_snapshot, updated_at = ? WHERE job_id = ?`
		).run(JSON.stringify(job), now, now, job.id);
	} else {
		db.prepare(
			`INSERT INTO automaton_attrs (job_id, last_seen_runtime_config, last_seen_at, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`
		).run(job.id, JSON.stringify(job), now, now, now);
	}
}

/** Derived health (doc 01: runs affect health, never lifecycle). */
export function automatonHealth(
	job: CronJob | null,
	attrs: AutomatonAttrsRow | null
): { health: string; reason?: string } {
	if (!job) {
		if (attrs?.deleted_at) return { health: 'deleted' };
		return { health: 'unreachable', reason: 'Runtime record not found' };
	}
	if (job.lastRunStatus === 'error') {
		return { health: 'failing', reason: job.lastRunError ?? 'Last run failed' };
	}
	if (!job.enabled) return { health: 'paused' };
	return { health: 'ok' };
}

function requireJobId(payload: Record<string, unknown>): string {
	return requireString(payload, 'id');
}

/**
 * Optimistic concurrency for runtime mutations: compare the caller's
 * expected_runtime_updated_at_ms against the live job before patching.
 */
function guardRuntimeVersion(job: CronJob, payload: Record<string, unknown>): void {
	const expected = payload.expected_runtime_updated_at_ms;
	if (expected !== undefined && typeof expected === 'number' && expected !== job.updatedAtMs) {
		throw new Work3Error('version_conflict', 'Automaton runtime changed since it was read', {
			details: { current_updated_at_ms: job.updatedAtMs, expected_updated_at_ms: expected }
		});
	}
}

async function loadLiveJob(id: string): Promise<CronJob> {
	const job = await getCronGateway().get(id);
	if (!job) {
		throw new Work3Error('not_found', `No such Automaton (OpenClaw job): ${id}`);
	}
	return job;
}

function attrsUpdate(ctx: ExecuteContext, jobId: string, fields: Record<string, unknown>): void {
	const attrs = loadAutomatonAttrs(ctx.db, jobId);
	if (!attrs) {
		ctx.db
			.prepare(
				`INSERT INTO automaton_attrs (job_id, project_id, summary, policies, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.run(
				jobId,
				(fields.project_id as string | null) ?? null,
				(fields.summary as string | null) ?? null,
				(fields.policies as string | undefined) ?? '{}',
				ctx.now,
				ctx.now
			);
		return;
	}
	ctx.db
		.prepare(
			`UPDATE automaton_attrs SET project_id = ?, summary = ?, policies = ?, updated_at = ? WHERE job_id = ?`
		)
		.run(
			fields.project_id !== undefined ? (fields.project_id as string | null) : attrs.project_id,
			fields.summary !== undefined ? (fields.summary as string | null) : attrs.summary,
			fields.policies !== undefined ? (fields.policies as string) : attrs.policies,
			ctx.now,
			jobId
		);
}

function automatonEvent(
	jobId: string,
	eventType: string,
	summary: string,
	payload: Record<string, unknown> = {}
) {
	return { event_type: eventType, subject_type: 'automaton', subject_id: jobId, summary, payload };
}

/** Build cron.add params from a create/restore payload. */
function buildAddParams(payload: Record<string, unknown>): Record<string, unknown> {
	const schedule = payload.schedule;
	if (!schedule || typeof schedule !== 'object') {
		throw new Work3Error('validation_failed', 'schedule is required ({kind: at|every|cron, ...})');
	}
	const jobPayload = payload.payload;
	if (
		!jobPayload ||
		typeof jobPayload !== 'object' ||
		typeof (jobPayload as Record<string, unknown>).kind !== 'string'
	) {
		throw new Work3Error(
			'validation_failed',
			'payload is required ({kind: systemEvent|agentTurn|command, ...})'
		);
	}
	return {
		name: requireString(payload, 'name', { maxLength: 200 }),
		...(typeof payload.description === 'string' ? { description: payload.description } : {}),
		schedule,
		payload: jobPayload,
		sessionTarget: optionalString(payload, 'session_target') ?? 'isolated',
		wakeMode: optionalString(payload, 'wake_mode') ?? 'next-heartbeat',
		...(payload.delivery && typeof payload.delivery === 'object'
			? { delivery: payload.delivery }
			: {}),
		...(typeof payload.agent_id === 'string' ? { agentId: payload.agent_id } : {}),
		// Automatons default to paused (doc 02).
		enabled: payload.enabled === true
	};
}

export function registerAutomatonCommands(): void {
	registerCommand({
		name: 'create_automaton',
		targetType: null,
		summary:
			'Create an Automaton (OpenClaw runtime object + Falcon attributes; defaults to paused)',
		requiresTarget: false,
		validate: (payload) => {
			buildAddParams(payload);
		},
		preGuards: [
			async (ctx: PreGuardContext) => {
				// Gateway first (doc 06). Failure here means nothing was created.
				const job = await getCronGateway().add(buildAddParams(ctx.payload));
				runtimeResults.set(ctx.payload, { job });
			}
		],
		execute: (ctx) => {
			const job = runtimeResults.get(ctx.payload)?.job;
			if (!job) throw new Work3Error('runtime_unavailable', 'Runtime create returned no job');
			const areaId = optionalString(ctx.payload, 'area_id') ?? null;
			if (areaId) {
				const area = loadArea(ctx.db, areaId);
				if (!area || area.state !== 'active') {
					// Runtime object already exists: report the partial state loudly
					// rather than pretending nothing happened.
					throw new Work3Error(
						'invariant_violation',
						`Area ${areaId} is missing/archived — runtime job ${job.id} was created and will surface as a discovered Automaton`,
						{ details: { job_id: job.id } }
					);
				}
			}
			ensureAutomatonEntity(ctx.db, job.id, areaId, ctx.now);
			recordRuntimeSnapshot(ctx.db, job, ctx.now);
			attrsUpdate(ctx, job.id, {
				project_id: optionalString(ctx.payload, 'project_id') ?? null,
				summary: optionalString(ctx.payload, 'summary') ?? null,
				policies: ctx.payload.policies ? JSON.stringify(ctx.payload.policies) : '{}'
			});
			return {
				result: { id: job.id, name: job.name, lifecycle: 'paused', enabled: job.enabled },
				events: [
					automatonEvent(
						job.id,
						'automaton_created',
						`Created Automaton "${job.name}" (${job.id}), paused`,
						{
							name: job.name
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'activate_automaton',
		targetType: null,
		summary: 'Enable the Automaton (mutates OpenClaw enabled state directly)',
		requiresTarget: false,
		validate: (payload) => {
			requireJobId(payload);
		},
		preGuards: [
			async (ctx) => {
				const id = requireJobId(ctx.payload);
				const job = await loadLiveJob(id);
				if (job.enabled) {
					runtimeResults.set(ctx.payload, { job, noop: true });
					return;
				}
				guardRuntimeVersion(job, ctx.payload);
				const updated = await getCronGateway().update(id, { enabled: true });
				runtimeResults.set(ctx.payload, { job: updated });
			}
		],
		execute: (ctx) => {
			const state = runtimeResults.get(ctx.payload)!;
			const job = state.job!;
			recordRuntimeSnapshot(ctx.db, job, ctx.now);
			if (state.noop) {
				return { result: { id: job.id, lifecycle: 'active' }, events: [], noop: true };
			}
			return {
				result: { id: job.id, lifecycle: 'active' },
				events: [automatonEvent(job.id, 'automaton_activated', `Activated Automaton ${job.id}`)]
			};
		}
	});

	registerCommand({
		name: 'pause_automaton',
		targetType: null,
		summary: 'Disable the Automaton (mutates OpenClaw enabled state directly)',
		requiresTarget: false,
		validate: (payload) => {
			requireJobId(payload);
		},
		preGuards: [
			async (ctx) => {
				const id = requireJobId(ctx.payload);
				const job = await loadLiveJob(id);
				if (!job.enabled) {
					runtimeResults.set(ctx.payload, { job, noop: true });
					return;
				}
				guardRuntimeVersion(job, ctx.payload);
				const updated = await getCronGateway().update(id, { enabled: false });
				runtimeResults.set(ctx.payload, { job: updated });
			}
		],
		execute: (ctx) => {
			const state = runtimeResults.get(ctx.payload)!;
			const job = state.job!;
			recordRuntimeSnapshot(ctx.db, job, ctx.now);
			if (state.noop) {
				return { result: { id: job.id, lifecycle: 'paused' }, events: [], noop: true };
			}
			return {
				result: { id: job.id, lifecycle: 'paused' },
				events: [automatonEvent(job.id, 'automaton_paused', `Paused Automaton ${job.id}`)]
			};
		}
	});

	registerCommand({
		name: 'update_automaton',
		targetType: null,
		summary: 'Update the same OpenClaw object and/or Falcon attributes (concurrency-guarded)',
		requiresTarget: false,
		validate: (payload) => {
			requireJobId(payload);
			optionalNumber(payload, 'expected_runtime_updated_at_ms');
		},
		preGuards: [
			async (ctx) => {
				const id = requireJobId(ctx.payload);
				const patch = ctx.payload.patch as Record<string, unknown> | undefined;
				const job = await loadLiveJob(id);
				guardRuntimeVersion(job, ctx.payload);
				if (patch && Object.keys(patch).length > 0) {
					const updated = await getCronGateway().update(id, patch);
					runtimeResults.set(ctx.payload, { job: updated });
				} else {
					runtimeResults.set(ctx.payload, { job });
				}
			}
		],
		execute: (ctx) => {
			const job = runtimeResults.get(ctx.payload)!.job!;
			recordRuntimeSnapshot(ctx.db, job, ctx.now);
			const attrFields: Record<string, unknown> = {};
			if (ctx.payload.summary !== undefined)
				attrFields.summary = optionalString(ctx.payload, 'summary') ?? null;
			if (ctx.payload.project_id !== undefined)
				attrFields.project_id = optionalString(ctx.payload, 'project_id') ?? null;
			if (ctx.payload.policies !== undefined)
				attrFields.policies = JSON.stringify(ctx.payload.policies);
			if (Object.keys(attrFields).length > 0) attrsUpdate(ctx, job.id, attrFields);
			const areaId = optionalString(ctx.payload, 'area_id');
			if (areaId !== undefined) {
				ctx.db.prepare('UPDATE entities SET area_id = ? WHERE id = ?').run(areaId, job.id);
			}
			return {
				result: { id: job.id, updated_at_ms: job.updatedAtMs },
				events: [
					automatonEvent(job.id, 'automaton_updated', `Updated Automaton ${job.id}`, {
						runtime_patched: ctx.payload.patch !== undefined,
						attrs_patched: Object.keys(attrFields).length > 0
					})
				]
			};
		}
	});

	registerCommand({
		name: 'delete_automaton',
		targetType: null,
		summary: 'Delete the runtime component; Falcon preserves the restoration snapshot',
		requiresTarget: false,
		validate: (payload) => {
			requireJobId(payload);
		},
		preGuards: [
			async (ctx) => {
				const id = requireJobId(ctx.payload);
				const job = await getCronGateway().get(id);
				if (!job) {
					// Already gone (possibly deleted directly) — idempotent path; the
					// snapshot we hold locally still serves restoration.
					runtimeResults.set(ctx.payload, { noop: true });
					return;
				}
				await getCronGateway().remove(id);
				runtimeResults.set(ctx.payload, { snapshot: job });
			}
		],
		execute: (ctx) => {
			const id = requireJobId(ctx.payload);
			const state = runtimeResults.get(ctx.payload)!;
			const attrs = loadAutomatonAttrs(ctx.db, id);
			if (state.noop && attrs?.deleted_at) {
				return { result: { id, lifecycle: 'deleted' }, events: [], noop: true };
			}
			const snapshot = state.snapshot
				? JSON.stringify(state.snapshot)
				: attrs?.last_seen_runtime_config;
			ensureAutomatonEntity(ctx.db, id, null, ctx.now);
			if (attrs) {
				ctx.db
					.prepare(
						`UPDATE automaton_attrs SET deleted_at = ?, deletion_snapshot = ?, deletion_source = ?, updated_at = ? WHERE job_id = ?`
					)
					.run(ctx.now, snapshot ?? null, 'falcon', ctx.now, id);
			} else {
				ctx.db
					.prepare(
						`INSERT INTO automaton_attrs (job_id, deleted_at, deletion_snapshot, deletion_source, created_at, updated_at)
						 VALUES (?, ?, ?, 'falcon', ?, ?)`
					)
					.run(id, ctx.now, snapshot ?? null, ctx.now, ctx.now);
			}
			return {
				result: { id, lifecycle: 'deleted', restorable: snapshot != null },
				events: [
					automatonEvent(
						id,
						'automaton_deleted',
						`Deleted Automaton ${id} (restoration snapshot preserved)`,
						{
							restorable: snapshot != null
						}
					)
				]
			};
		}
	});

	registerCommand({
		name: 'restore_automaton',
		targetType: null,
		summary: 'Recreate the runtime component from the snapshot; returns paused with lineage',
		requiresTarget: false,
		validate: (payload) => {
			requireJobId(payload);
		},
		preGuards: [
			async (ctx) => {
				const id = requireJobId(ctx.payload);
				const attrs = loadAutomatonAttrs(ctx.db, id);
				if (!attrs?.deleted_at) {
					throw new Work3Error('transition_not_allowed', `Automaton ${id} is not deleted`, {
						details: { id }
					});
				}
				const snapshotRaw = attrs.deletion_snapshot ?? attrs.last_seen_runtime_config;
				if (!snapshotRaw) {
					throw new Work3Error(
						'transition_requirements_not_met',
						`No restoration snapshot exists for ${id}`
					);
				}
				const snapshot = JSON.parse(snapshotRaw) as CronJob;
				// Restore produces a NEW runtime id; Falcon re-binds attributes with
				// lineage recorded (verified: declarationKey does not preserve ids
				// for API-created jobs).
				const job = await getCronGateway().add({
					name: snapshot.name,
					...(snapshot.description ? { description: snapshot.description } : {}),
					schedule: snapshot.schedule,
					payload: snapshot.payload,
					sessionTarget: snapshot.sessionTarget,
					wakeMode: snapshot.wakeMode,
					...(snapshot.delivery ? { delivery: snapshot.delivery } : {}),
					...(snapshot.agentId ? { agentId: snapshot.agentId } : {}),
					enabled: false
				});
				runtimeResults.set(ctx.payload, { job });
			}
		],
		execute: (ctx) => {
			const priorId = requireJobId(ctx.payload);
			const job = runtimeResults.get(ctx.payload)!.job!;
			const prior = loadAutomatonAttrs(ctx.db, priorId)!;
			const priorEntity = loadEntity(ctx.db, priorId);
			ensureAutomatonEntity(ctx.db, job.id, priorEntity?.area_id ?? null, ctx.now);
			recordRuntimeSnapshot(ctx.db, job, ctx.now);
			ctx.db
				.prepare(
					`UPDATE automaton_attrs SET project_id = ?, summary = ?, policies = ?, restored_from = ?, restored_at = ?, updated_at = ?
					 WHERE job_id = ?`
				)
				.run(prior.project_id, prior.summary, prior.policies, priorId, ctx.now, ctx.now, job.id);
			return {
				result: { id: job.id, lifecycle: 'paused', restored_from: priorId },
				events: [
					automatonEvent(
						job.id,
						'automaton_restored',
						`Restored Automaton ${priorId} as ${job.id} (paused)`,
						{
							restored_from: priorId
						}
					),
					automatonEvent(
						priorId,
						'automaton_restore_lineage',
						`Automaton ${priorId} restored as ${job.id}`,
						{
							restored_as: job.id
						}
					)
				]
			};
		}
	});
}

/**
 * Reconcile local snapshots with the live runtime: refresh snapshots for
 * present jobs, and mark locally-known jobs that vanished (deleted directly in
 * OpenClaw) as deleted with their snapshot preserved. This is snapshot
 * maintenance for recoverable deletion — not desired-state reconciliation.
 */
export async function syncAutomatonsOnce(): Promise<{ seen: number; newly_deleted: string[] }> {
	const jobs = await getCronGateway().list();
	const db = getWork3Db();
	const now = Date.now();
	const liveIds = new Set(jobs.map((job) => job.id));
	const newlyDeleted: string[] = [];
	const apply = db.transaction(() => {
		for (const job of jobs) {
			recordRuntimeSnapshot(db, job, now);
		}
		const known = db
			.prepare(
				`SELECT job_id, last_seen_runtime_config FROM automaton_attrs WHERE deleted_at IS NULL`
			)
			.all() as Array<{ job_id: string; last_seen_runtime_config: string | null }>;
		for (const row of known) {
			if (!liveIds.has(row.job_id)) {
				db.prepare(
					`UPDATE automaton_attrs SET deleted_at = ?, deletion_snapshot = COALESCE(deletion_snapshot, last_seen_runtime_config),
					 deletion_source = 'openclaw', updated_at = ? WHERE job_id = ?`
				).run(now, now, row.job_id);
				newlyDeleted.push(row.job_id);
			}
		}
	});
	apply();
	return { seen: jobs.length, newly_deleted: newlyDeleted };
}
