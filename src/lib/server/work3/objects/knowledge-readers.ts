import { getWork3Db } from '../db.js';
import { listWork3Events } from '../eventlog.js';
import { registerObjectReader } from '../read/registry.js';
import { answerHistory, currentAnswer, type QuestionRow } from './question.js';
import { currentPackage, packageHistory, type DecisionRow } from './decision.js';
import type { FindingRow } from './finding.js';

/** AXI projections for Question, Decision, Finding (doc 04). */

interface EnvelopeJoin {
	id: string;
	area_id: string | null;
	created_at: number;
	updated_at: number;
	version: number;
}

function parseJson<T>(raw: string | null, fallback: T): T {
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function registerKnowledgeReaders(): void {
	registerObjectReader({
		type: 'question',
		aliases: ['questions'],
		knownFields: [
			'id',
			'question',
			'status',
			'priority',
			'answerable_by',
			'steward',
			'impact',
			'context',
			'working_hypothesis',
			'answer',
			'answer_history',
			'target_at',
			'area_id',
			'version',
			'created_at',
			'updated_at',
			'history'
		],
		knownFilters: ['status', 'area', 'steward', 'priority'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.status) {
				clauses.push('q.status = ?');
				params.push(options.filters.status);
			}
			if (options.filters.area) {
				clauses.push('e.area_id = ?');
				params.push(options.filters.area);
			}
			if (options.filters.steward) {
				clauses.push('q.steward = ?');
				params.push(options.filters.steward);
			}
			if (options.filters.priority) {
				clauses.push('q.priority = ?');
				params.push(options.filters.priority);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db
					.prepare(
						`SELECT COUNT(*) AS count FROM questions q JOIN entities e ON e.id = q.entity_id ${where}`
					)
					.get(...params) as { count: number }
			).count;
			const rows = db
				.prepare(
					`SELECT q.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM questions q JOIN entities e ON e.id = q.entity_id ${where}
					 ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<QuestionRow & EnvelopeJoin>;
			return {
				items: rows.map((row) => questionProjection(row, options.view)),
				total
			};
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT q.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM questions q JOIN entities e ON e.id = q.entity_id WHERE q.entity_id = ?`
				)
				.get(id) as (QuestionRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return questionProjection(row, options.view === 'list' ? 'list' : options.view);
		}
	});

	registerObjectReader({
		type: 'decision',
		aliases: ['decisions'],
		knownFields: [
			'id',
			'title',
			'prompt',
			'status',
			'deciders',
			'recommendation',
			'consequence_of_no_decision',
			'options',
			'context',
			'stakes',
			'outcome',
			'needed_by',
			'priority',
			'supersedes',
			'superseded_by',
			'package_id',
			'package_history',
			'area_id',
			'version',
			'created_at',
			'updated_at',
			'history'
		],
		knownFilters: ['status', 'area', 'priority'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.status) {
				clauses.push('d.status = ?');
				params.push(options.filters.status);
			}
			if (options.filters.area) {
				clauses.push('e.area_id = ?');
				params.push(options.filters.area);
			}
			if (options.filters.priority) {
				clauses.push('d.priority = ?');
				params.push(options.filters.priority);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db
					.prepare(
						`SELECT COUNT(*) AS count FROM decisions d JOIN entities e ON e.id = d.entity_id ${where}`
					)
					.get(...params) as { count: number }
			).count;
			const rows = db
				.prepare(
					`SELECT d.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM decisions d JOIN entities e ON e.id = d.entity_id ${where}
					 ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<DecisionRow & EnvelopeJoin>;
			return {
				items: rows.map((row) => decisionProjection(row, options.view)),
				total
			};
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT d.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM decisions d JOIN entities e ON e.id = d.entity_id WHERE d.entity_id = ?`
				)
				.get(id) as (DecisionRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return decisionProjection(row, options.view === 'list' ? 'list' : options.view);
		}
	});

	registerObjectReader({
		type: 'finding',
		aliases: ['findings'],
		knownFields: [
			'id',
			'title',
			'confidence',
			'validity',
			'source_count',
			'conclusion',
			'significance',
			'source_refs',
			'targets',
			'observed_at',
			'author',
			'supersedes',
			'superseded_by',
			'retract_reason',
			'area_id',
			'version',
			'created_at',
			'updated_at',
			'history'
		],
		knownFilters: ['validity', 'confidence', 'area', 'target'],
		list: (options) => {
			const db = getWork3Db();
			const clauses: string[] = [];
			const params: unknown[] = [];
			if (options.filters.validity) {
				clauses.push('f.validity = ?');
				params.push(options.filters.validity);
			}
			if (options.filters.confidence) {
				clauses.push('f.confidence = ?');
				params.push(options.filters.confidence);
			}
			if (options.filters.area) {
				clauses.push('e.area_id = ?');
				params.push(options.filters.area);
			}
			if (options.filters.target) {
				clauses.push(`EXISTS (SELECT 1 FROM json_each(f.targets) WHERE json_each.value = ?)`);
				params.push(options.filters.target);
			}
			const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
			const total = (
				db
					.prepare(
						`SELECT COUNT(*) AS count FROM findings f JOIN entities e ON e.id = f.entity_id ${where}`
					)
					.get(...params) as { count: number }
			).count;
			const rows = db
				.prepare(
					`SELECT f.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM findings f JOIN entities e ON e.id = f.entity_id ${where}
					 ORDER BY e.created_at DESC LIMIT ? OFFSET ?`
				)
				.all(...params, options.limit, options.offset) as Array<FindingRow & EnvelopeJoin>;
			return {
				items: rows.map((row) => findingProjection(row, options.view)),
				total
			};
		},
		get: (id, options) => {
			const db = getWork3Db();
			const row = db
				.prepare(
					`SELECT f.*, e.id, e.area_id, e.created_at, e.updated_at, e.version
					 FROM findings f JOIN entities e ON e.id = f.entity_id WHERE f.entity_id = ?`
				)
				.get(id) as (FindingRow & EnvelopeJoin) | undefined;
			if (!row) return null;
			return findingProjection(row, options.view === 'list' ? 'list' : options.view);
		}
	});
}

function questionProjection(
	row: QuestionRow & EnvelopeJoin,
	view: string
): Record<string, unknown> {
	const base = {
		id: row.id,
		question: row.question,
		status: row.status,
		priority: row.priority,
		answerable_by: parseJson<string[]>(row.answerable_by, []),
		version: row.version
	};
	if (view === 'list') {
		const answer = row.status === 'answered' ? currentAnswer(getWork3Db(), row.id) : null;
		return { ...base, ...(answer ? { answer: answer.answer.slice(0, 200) } : {}) };
	}
	const answer = currentAnswer(getWork3Db(), row.id);
	const detail = {
		...base,
		context: row.context,
		impact: row.impact,
		steward: row.steward,
		working_hypothesis: parseJson<unknown>(row.working_hypothesis, null),
		target_at: row.target_at,
		area_id: row.area_id,
		created_at: row.created_at,
		updated_at: row.updated_at,
		answer: answer
			? {
					id: answer.id,
					answer: answer.answer,
					answerer: answer.answerer_label,
					confidence: answer.confidence,
					answered_at: answer.created_at,
					source_refs: parseJson<unknown[]>(answer.source_refs, [])
				}
			: null
	};
	if (view === 'full') {
		return {
			...detail,
			answer_history: answerHistory(getWork3Db(), row.id).map((revision) => ({
				id: revision.id,
				answer: revision.answer,
				answerer: revision.answerer_label,
				confidence: revision.confidence,
				created_at: revision.created_at,
				supersedes: revision.supersedes,
				is_current: revision.is_current === 1
			})),
			history: listWork3Events({ subjectId: row.id, limit: 100 })
		};
	}
	return detail;
}

function decisionProjection(
	row: DecisionRow & EnvelopeJoin,
	view: string
): Record<string, unknown> {
	const pkg = currentPackage(getWork3Db(), row.id);
	const recommendation = pkg ? parseJson<Record<string, unknown>>(pkg.recommendation, {}) : {};
	const base = {
		id: row.id,
		title: pkg?.title ?? '(missing package)',
		status: row.status,
		deciders: pkg ? parseJson<string[]>(pkg.deciders, []) : [],
		version: row.version
	};
	if (view === 'list') return base;
	const detail = {
		...base,
		prompt: pkg?.prompt,
		context: pkg?.context,
		stakes: pkg?.stakes,
		consequence_of_no_decision: pkg?.consequence_of_no_decision,
		options: pkg ? parseJson<unknown[]>(pkg.options, []) : [],
		recommendation,
		outcome: parseJson<unknown>(row.outcome, null),
		needed_by: row.needed_by,
		priority: row.priority,
		supersedes: row.supersedes_decision_id,
		superseded_by: row.superseded_by,
		package_id: pkg?.id,
		area_id: row.area_id,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
	if (view === 'full') {
		return {
			...detail,
			package_history: packageHistory(getWork3Db(), row.id).map((revision) => ({
				id: revision.id,
				title: revision.title,
				created_at: revision.created_at,
				supersedes: revision.supersedes,
				is_current: revision.is_current === 1
			})),
			history: listWork3Events({ subjectId: row.id, limit: 100 })
		};
	}
	return detail;
}

function findingProjection(row: FindingRow & EnvelopeJoin, view: string): Record<string, unknown> {
	const sourceRefs = parseJson<unknown[]>(row.source_refs, []);
	const base = {
		id: row.id,
		title: row.title,
		confidence: row.confidence,
		validity: row.validity,
		source_count: sourceRefs.length,
		version: row.version
	};
	if (view === 'list') return base;
	const detail = {
		...base,
		conclusion: row.conclusion,
		significance: row.significance,
		source_refs: sourceRefs,
		targets: parseJson<string[]>(row.targets, []),
		observed_at: row.observed_at,
		author: row.author_label,
		supersedes: row.supersedes_finding_id,
		superseded_by: row.superseded_by,
		retract_reason: row.retract_reason,
		area_id: row.area_id,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
	if (view === 'full') {
		return { ...detail, history: listWork3Events({ subjectId: row.id, limit: 100 }) };
	}
	return detail;
}
