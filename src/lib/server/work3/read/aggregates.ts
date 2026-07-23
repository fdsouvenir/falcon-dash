import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { getWork3Db } from '../db.js';
import { listWork3Events } from '../eventlog.js';
import { getCronGateway } from '../cron-gateway.js';
import { loadAutomatonAttrs, automatonHealth } from '../objects/automaton.js';
import { effectiveAuthorization } from '../objects/change.js';
import { reviewDisposition } from './governance-derived.js';
import { currentPlanRevision } from '../objects/plan.js';

/**
 * Server-computed aggregates (doc 04): `queue` and `brief` are bounded,
 * bucketized single-pass SQL — common workflows never need per-object lookup
 * loops. Every bucket returns a total plus a bounded set of compact rows.
 */

const BUCKET_LIMIT = 8;

export interface QueueBucket {
	total: number;
	items: Array<Record<string, unknown>>;
}

export interface Work3Queue {
	actionable_now: QueueBucket;
	needs_fred: QueueBucket;
	waiting_on_agent: QueueBucket;
	waiting_on_external: QueueBucket;
	blocked_risk: QueueBucket;
	awaiting_review: QueueBucket;
	changes_needing_authorization_or_verification: QueueBucket;
	unhealthy_automata: QueueBucket;
	needs_reconciliation: QueueBucket;
}

function bucket(rows: Array<Record<string, unknown>>): QueueBucket {
	return { total: rows.length, items: rows.slice(0, BUCKET_LIMIT) };
}

/** Waiting-on classification: agent identities vs everything else. */
function isAgentIdentity(value: string | null): boolean {
	if (!value) return false;
	return value.startsWith('agent') || value.startsWith('bot');
}

export async function computeQueue(db: Database.Database = getWork3Db()): Promise<Work3Queue> {
	// Actionable now: unblocked ready/in_progress tasks.
	const actionable = db
		.prepare(
			`SELECT t.entity_id AS id, 'task' AS type, t.title, t.status, t.owner, t.priority
			 FROM tasks t
			 WHERE t.status IN ('ready','in_progress')
			   AND NOT EXISTS (SELECT 1 FROM blockers b WHERE b.blocked_id = t.entity_id AND b.state = 'active')
			 ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
			          t.entity_id`
		)
		.all() as Array<Record<string, unknown>>;

	// Needs Fred: pending/deferred Decisions, open Questions, in_review Tasks.
	const needsFred = [
		...(db
			.prepare(
				`SELECT d.entity_id AS id, 'decision' AS type, p.title, d.status,
				        p.consequence_of_no_decision AS why
				 FROM decisions d
				 LEFT JOIN decision_packages p ON p.parent_id = d.entity_id AND p.is_current = 1
				 WHERE d.status IN ('pending','deferred') ORDER BY d.entity_id`
			)
			.all() as Array<Record<string, unknown>>),
		...(db
			.prepare(
				`SELECT q.entity_id AS id, 'question' AS type, q.question AS title, q.status, q.impact AS why
				 FROM questions q WHERE q.status = 'open' ORDER BY q.entity_id`
			)
			.all() as Array<Record<string, unknown>>),
		...(db
			.prepare(
				`SELECT t.entity_id AS id, 'task' AS type, t.title, t.status,
				        'Output awaiting review' AS why
				 FROM tasks t WHERE t.status = 'in_review' ORDER BY t.entity_id`
			)
			.all() as Array<Record<string, unknown>>)
	];

	// Waiting, classified by who is waited on.
	const waiting = db
		.prepare(
			`SELECT t.entity_id AS id, 'task' AS type, t.title, t.waiting_on, t.waiting_reason AS why,
			        t.waiting_since
			 FROM tasks t WHERE t.status = 'waiting' ORDER BY t.waiting_since ASC`
		)
		.all() as Array<Record<string, unknown> & { waiting_on: string | null }>;
	const waitingOnAgent = waiting.filter((row) => isAgentIdentity(row.waiting_on));
	const waitingOnExternal = waiting.filter((row) => !isAgentIdentity(row.waiting_on));

	// Blocked risk: any actionable Work with active blockers.
	const blocked = db
		.prepare(
			`SELECT b.blocked_id AS id, e.type,
			        COALESCE(t.title, q.question, cr.title, b.blocked_id) AS title,
			        b.reason AS why, b.resolution_condition,
			        MIN(e2.created_at) AS blocked_since
			 FROM blockers b
			 JOIN entities e ON e.id = b.blocked_id
			 JOIN entities e2 ON e2.id = b.entity_id
			 LEFT JOIN tasks t ON t.entity_id = b.blocked_id
			 LEFT JOIN questions q ON q.entity_id = b.blocked_id
			 LEFT JOIN change_requests cr ON cr.entity_id = b.blocked_id
			 WHERE b.state = 'active'
			 GROUP BY b.blocked_id ORDER BY blocked_since ASC`
		)
		.all() as Array<Record<string, unknown>>;

	// Awaiting Review: submitted Plans with an unreviewed current revision.
	const submittedPlans = db
		.prepare(
			`SELECT p.entity_id AS id, 'plan' AS type, p.title, r.id AS revision_id
			 FROM plans p JOIN plan_revisions r ON r.parent_id = p.entity_id AND r.is_current = 1
			 WHERE r.state = 'submitted' ORDER BY r.created_at ASC`
		)
		.all() as Array<Record<string, unknown> & { id: string; revision_id: string }>;
	const awaitingReview = submittedPlans
		.filter((plan) => reviewDisposition(db, plan.id, plan.revision_id) === 'unreviewed')
		.map(({ id, type, title }) => ({ id, type, title, why: 'Submitted, no Review yet' }));

	// Changes lacking valid Authorization (pre-execution) or verification.
	const openChanges = db
		.prepare(
			`SELECT c.entity_id AS id, c.title, c.execution_state, c.verification_state, c.plan_id
			 FROM change_requests c
			 WHERE c.execution_state IN ('not_started','failed','paused')
			    OR (c.execution_state = 'succeeded' AND c.verification_state NOT IN ('passed','waived'))
			 ORDER BY c.entity_id`
		)
		.all() as Array<
		Record<string, unknown> & {
			id: string;
			execution_state: string;
			verification_state: string;
			plan_id: string | null;
		}
	>;
	const changesNeeding = openChanges
		.map((change) => {
			if (change.execution_state === 'succeeded') {
				return {
					...change,
					type: 'change_request',
					why: `Verification ${change.verification_state}`
				};
			}
			const authorization = effectiveAuthorization(db, change.id, Date.now());
			if (authorization.state !== 'valid') {
				const planReady =
					change.plan_id !== null && currentPlanRevision(db, change.plan_id)?.state === 'submitted';
				return {
					id: change.id,
					type: 'change_request',
					title: change.title,
					execution_state: change.execution_state,
					why: `Authorization ${authorization.state}${planReady ? '' : ' (plan not submitted)'}`
				};
			}
			return null;
		})
		.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

	// Unhealthy Automata (live gateway; unreachable runtime is itself the news).
	let unhealthyAutomata: Array<Record<string, unknown>>;
	try {
		const jobs = await getCronGateway().list();
		unhealthyAutomata = jobs
			.map((job) => ({ job, health: automatonHealth(job, loadAutomatonAttrs(db, job.id)) }))
			.filter(({ health }) => health.health === 'failing')
			.map(({ job, health }) => ({
				id: job.id,
				type: 'automaton',
				title: job.name,
				why: health.reason ?? 'Last run failed'
			}));
	} catch {
		unhealthyAutomata = [
			{
				id: '(gateway)',
				type: 'automaton',
				title: 'OpenClaw runtime unreachable',
				why: 'Cannot read Automaton health'
			}
		];
	}

	// Reconciliation problems: active Projects with no next item; invalidated
	// satisfies assertions whose criterion is now unproven.
	const reconciliation = [
		...(db
			.prepare(
				`SELECT p.entity_id AS id, 'project' AS type, p.title,
				        'Active with no current next item' AS why
				 FROM projects p WHERE p.status = 'active' AND p.current_next_item_id IS NULL AND p.archived_at IS NULL`
			)
			.all() as Array<Record<string, unknown>>),
		...(db
			.prepare(
				`SELECT r.id, 'relationship' AS type,
				        r.source_id || ' satisfies ' || r.target_id AS title,
				        'Satisfies assertion invalidated: ' || coalesce(r.invalidated_reason, '') AS why
				 FROM relationships r
				 WHERE r.rel_type = 'satisfies' AND r.invalidated_at IS NOT NULL AND r.removed_at IS NULL`
			)
			.all() as Array<Record<string, unknown>>)
	];

	return {
		actionable_now: bucket(actionable),
		needs_fred: bucket(needsFred),
		waiting_on_agent: bucket(waitingOnAgent),
		waiting_on_external: bucket(waitingOnExternal),
		blocked_risk: bucket(blocked),
		awaiting_review: bucket(awaitingReview),
		changes_needing_authorization_or_verification: bucket(changesNeeding),
		unhealthy_automata: bucket(unhealthyAutomata),
		needs_reconciliation: bucket(reconciliation)
	};
}

/** Authority-creating event types — unconditionally in the material feed. */
const AUTHORITY_EVENT_TYPES = new Set([
	'decision_decided',
	'authorization_granted',
	'authorization_revoked',
	'change_verification_waived',
	'criterion_waived'
]);

/** Routine noise excluded from the material feed. */
const ROUTINE_EVENT_TYPES = new Set([
	'task_updated',
	'question_updated',
	'area_updated',
	'plan_updated',
	'automaton_updated'
]);

export function materialRecentChanges(limit = 20): Array<Record<string, unknown>> {
	const events = listWork3Events({ limit: 200 });
	const material = events.filter(
		(event) =>
			AUTHORITY_EVENT_TYPES.has(event.event_type) || !ROUTINE_EVENT_TYPES.has(event.event_type)
	);
	return material.slice(0, limit).map((event) => ({
		id: event.id,
		at: event.occurred_at,
		event: event.event_type,
		summary: event.summary,
		actor: event.actor.label,
		subject_id: event.subject_id,
		authority_act: AUTHORITY_EVENT_TYPES.has(event.event_type),
		// Authority acts carry their claimed human source, resolvable to the
		// original instruction (doc 05 / #327 actor model).
		...(AUTHORITY_EVENT_TYPES.has(event.event_type) ? { authority_sources: event.source_refs } : {})
	}));
}

const BRIEF_LIMIT = 5;

/**
 * Session-start brief (doc 04): bounded, cacheable; excludes closed history,
 * full Plans, routine Runs, and generic advice.
 */
export async function computeBrief(
	db: Database.Database = getWork3Db()
): Promise<Record<string, unknown>> {
	const queue = await computeQueue(db);
	return {
		actionable_now: {
			total: queue.actionable_now.total,
			items: queue.actionable_now.items.slice(0, BRIEF_LIMIT)
		},
		needs_fred: {
			total: queue.needs_fred.total,
			items: queue.needs_fred.items.slice(0, BRIEF_LIMIT)
		},
		blocked_risk: {
			total: queue.blocked_risk.total,
			items: queue.blocked_risk.items.slice(0, BRIEF_LIMIT)
		},
		unhealthy_automata: queue.unhealthy_automata,
		recent_changes: materialRecentChanges(BRIEF_LIMIT),
		help: [
			'falcon queue — full buckets with totals',
			'falcon work get <id> — detail with legal next actions',
			'falcon work search <query> — find Work by text'
		]
	};
}

const SEARCH_TYPES = [
	'task',
	'question',
	'decision',
	'finding',
	'project',
	'change_request',
	'area'
];

/** FTS5 Browse search. Unknown type filters fail loudly (doc 04/05). */
export function searchWork(
	query: string,
	options: { type?: string; limit?: number } = {}
): Array<Record<string, unknown>> {
	if (options.type && !SEARCH_TYPES.includes(options.type)) {
		throw new Work3Error('validation_failed', `Unknown search type: ${options.type}`, {
			details: { known_types: SEARCH_TYPES }
		});
	}
	const db = getWork3Db();
	const limit = Math.min(options.limit ?? 25, 100);
	// Quote each term to keep FTS5 syntax from leaking as loud errors on user input.
	const sanitized = query
		.split(/\s+/)
		.filter((term) => term.length > 0)
		.map((term) => `"${term.replaceAll('"', '""')}"`)
		.join(' ');
	if (!sanitized) {
		throw new Work3Error('validation_failed', 'Search query must not be empty');
	}
	const clauses = ['work_search MATCH ?'];
	const params: unknown[] = [sanitized];
	if (options.type) {
		clauses.push('type = ?');
		params.push(options.type);
	}
	return db
		.prepare(
			`SELECT entity_id AS id, type, title, snippet(work_search, 3, '[', ']', '…', 12) AS snippet,
			        bm25(work_search) AS rank
			 FROM work_search WHERE ${clauses.join(' AND ')} ORDER BY rank LIMIT ?`
		)
		.all(...params, limit) as Array<Record<string, unknown>>;
}
