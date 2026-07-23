import { getWork3Db } from '../db.js';
import { listWork3Events } from '../eventlog.js';
import { registerObjectReader } from '../read/registry.js';
import { getCronGateway, type CronJob } from '../cron-gateway.js';
import {
	automatonHealth,
	loadAutomatonAttrs,
	recordRuntimeSnapshot,
	type AutomatonAttrsRow
} from './automaton.js';

/**
 * Automaton read-through (docs 01/06): the API composes the LIVE OpenClaw
 * record with Falcon extension attributes into one representation. Direct
 * OpenClaw edits appear here with no sync step; Runs are read straight from
 * cron.runs with no Falcon Run artifact.
 */

function parseJson<T>(raw: string | null, fallback: T): T {
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function compose(
	job: CronJob | null,
	attrs: AutomatonAttrsRow | null,
	areaId: string | null,
	view: string
): Record<string, unknown> {
	const health = automatonHealth(job, attrs);
	const lifecycle = job
		? job.enabled
			? 'active'
			: 'paused'
		: attrs?.deleted_at
			? 'deleted'
			: 'unknown';
	const snapshot =
		job ??
		parseJson<CronJob | null>(
			attrs?.deletion_snapshot ?? attrs?.last_seen_runtime_config ?? null,
			null
		);
	const base = {
		id: (job?.id ?? attrs?.job_id)!,
		name: snapshot?.name ?? '(unknown)',
		lifecycle,
		health: health.health,
		...(health.reason ? { health_reason: health.reason } : {}),
		schedule: snapshot?.schedule ?? null,
		next_run_at_ms: job?.nextRunAtMs ?? null,
		last_run_status: job?.lastRunStatus ?? null
	};
	if (view === 'list') return base;
	return {
		...base,
		description: snapshot?.description ?? null,
		agent_id: snapshot?.agentId ?? null,
		session_target: snapshot?.sessionTarget ?? null,
		wake_mode: snapshot?.wakeMode ?? null,
		payload_summary: snapshot?.payload
			? { kind: (snapshot.payload as Record<string, unknown>).kind }
			: null,
		payload: snapshot?.payload ?? null,
		delivery: snapshot?.delivery ?? null,
		runtime_updated_at_ms: job?.updatedAtMs ?? null,
		last_run_at_ms: job?.lastRunAtMs ?? null,
		last_run_error: job?.lastRunError ?? null,
		last_delivery_status: job?.lastDeliveryStatus ?? null,
		area_id: areaId,
		project_id: attrs?.project_id ?? null,
		summary: attrs?.summary ?? null,
		policies: parseJson<Record<string, unknown>>(attrs?.policies ?? null, {}),
		deleted_at: attrs?.deleted_at ?? null,
		restorable:
			attrs?.deleted_at != null &&
			(attrs.deletion_snapshot ?? attrs.last_seen_runtime_config) != null,
		restored_from: attrs?.restored_from ?? null
	};
}

function areaOf(jobId: string): string | null {
	const row = getWork3Db().prepare('SELECT area_id FROM entities WHERE id = ?').get(jobId) as
		| { area_id: string | null }
		| undefined;
	return row?.area_id ?? null;
}

export function registerAutomatonReader(): void {
	registerObjectReader({
		type: 'automaton',
		aliases: ['automatons', 'automata'],
		knownFields: [
			'id',
			'name',
			'lifecycle',
			'health',
			'health_reason',
			'schedule',
			'next_run_at_ms',
			'last_run_status',
			'description',
			'agent_id',
			'session_target',
			'wake_mode',
			'payload_summary',
			'payload',
			'delivery',
			'runtime_updated_at_ms',
			'last_run_at_ms',
			'last_run_error',
			'last_delivery_status',
			'area_id',
			'project_id',
			'summary',
			'policies',
			'deleted_at',
			'restorable',
			'restored_from',
			'runs',
			'history'
		],
		knownFilters: ['lifecycle'],
		list: async (options) => {
			const db = getWork3Db();
			const jobs = await getCronGateway().list();
			const now = Date.now();
			for (const job of jobs) recordRuntimeSnapshot(db, job, now);
			const liveIds = new Set(jobs.map((job) => job.id));
			const deletedRows =
				options.filters.lifecycle === undefined || options.filters.lifecycle === 'deleted'
					? (db
							.prepare(`SELECT * FROM automaton_attrs WHERE deleted_at IS NOT NULL`)
							.all() as AutomatonAttrsRow[])
					: [];
			let items = [
				...jobs.map((job) =>
					compose(job, loadAutomatonAttrs(db, job.id), areaOf(job.id), options.view)
				),
				...deletedRows
					.filter((attrs) => !liveIds.has(attrs.job_id))
					.map((attrs) => compose(null, attrs, areaOf(attrs.job_id), options.view))
			];
			if (options.filters.lifecycle) {
				items = items.filter((item) => item.lifecycle === options.filters.lifecycle);
			}
			return {
				items: items.slice(options.offset, options.offset + options.limit),
				total: items.length
			};
		},
		get: async (id, options) => {
			const db = getWork3Db();
			const job = await getCronGateway().get(id);
			const attrs = loadAutomatonAttrs(db, id);
			if (!job && !attrs) return null;
			if (job) recordRuntimeSnapshot(db, job, Date.now());
			const composed = compose(
				job,
				attrs ?? loadAutomatonAttrs(db, id),
				areaOf(id),
				options.view === 'list' ? 'list' : 'detail'
			);
			if (options.view === 'full') {
				// Read-through native Runs — no Falcon Run artifact (doc 01).
				const runs = job ? await getCronGateway().runs(id, 20) : [];
				return {
					...composed,
					runs,
					history: listWork3Events({ subjectId: id, limit: 50 })
				};
			}
			return composed;
		}
	});
}
