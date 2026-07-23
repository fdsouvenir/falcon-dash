import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { allocateEntityId, insertEntity } from '../envelope.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import {
	optionalEnum,
	optionalNumber,
	optionalString,
	requireEnum,
	requireString
} from '../engine/validate.js';
import { appendRevision, currentRevision, revisionHistory } from '../revisions.js';
import { requireActiveArea } from './area.js';
import { TASK_PRIORITIES } from './task.js';

/**
 * Question (docs 01–02): open → answered | withdrawn, explicit reopening.
 * Answers are immutable revisions; re-answering preserves history. Working
 * hypotheses never change lifecycle.
 */

export const ANSWER_CONFIDENCES = ['tentative', 'supported', 'confirmed'] as const;

export interface QuestionRow {
	entity_id: string;
	project_id: string | null;
	phase_id: string | null;
	question: string;
	context: string | null;
	impact: string | null;
	status: 'open' | 'answered' | 'withdrawn';
	priority: string | null;
	steward: string | null;
	answerable_by: string;
	working_hypothesis: string | null;
	target_at: number | null;
	withdrawn_at: number | null;
	withdraw_reason: string | null;
}

export interface AnswerRow {
	id: string;
	parent_id: string;
	supersedes: string | null;
	is_current: number;
	created_at: number;
	answer: string;
	answerer_kind: string;
	answerer_id: string;
	answerer_label: string;
	confidence: string;
	source_refs: string;
}

export function loadQuestion(db: Database.Database, id: string): QuestionRow | null {
	return (db.prepare('SELECT * FROM questions WHERE entity_id = ?').get(id) as QuestionRow) ?? null;
}

export function currentAnswer(db: Database.Database, questionId: string): AnswerRow | null {
	return currentRevision<AnswerRow>(db, 'question_answers', questionId);
}

export function answerHistory(db: Database.Database, questionId: string): AnswerRow[] {
	return revisionHistory<AnswerRow>(db, 'question_answers', questionId);
}

function question(ctx: ExecuteContext): QuestionRow {
	const row = loadQuestion(ctx.db, ctx.targetId!);
	if (!row)
		throw new Work3Error('invariant_violation', `Question head row missing for ${ctx.targetId}`);
	return row;
}

function parseHypothesis(payload: Record<string, unknown>): string | null | undefined {
	if (payload.working_hypothesis === undefined) return undefined;
	if (payload.working_hypothesis === null) return null;
	const raw = payload.working_hypothesis;
	if (typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Work3Error('validation_failed', 'working_hypothesis must be an object');
	}
	const candidate = raw as Record<string, unknown>;
	if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
		throw new Work3Error('validation_failed', 'working_hypothesis.text is required');
	}
	if (
		typeof candidate.confidence !== 'string' ||
		!(ANSWER_CONFIDENCES as readonly string[]).includes(candidate.confidence)
	) {
		throw new Work3Error(
			'validation_failed',
			`working_hypothesis.confidence must be one of: ${ANSWER_CONFIDENCES.join(', ')}`
		);
	}
	const refs = parseSourceRefs(candidate.source_refs, { required: true });
	return JSON.stringify({
		text: candidate.text.trim(),
		confidence: candidate.confidence,
		source_refs: refs
	});
}

function parseIdentityList(payload: Record<string, unknown>, field: string): string | undefined {
	if (payload[field] === undefined) return undefined;
	const raw = payload[field];
	if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string')) {
		throw new Work3Error('validation_failed', `${field} must be an array of identity strings`);
	}
	return JSON.stringify(raw);
}

/**
 * Deterministic blocker auto-resolution on authoritative answers (doc 02):
 * active Blockers whose dependency source is this Question resolve; anything
 * else only gets suggested externally.
 */
function autoResolveQuestionBlockers(ctx: ExecuteContext, answerEventRef: string) {
	const blockers = ctx.db
		.prepare(
			`SELECT entity_id, blocked_id FROM blockers
			 WHERE source_kind = 'work' AND source_work_id = ? AND state = 'active'`
		)
		.all(ctx.targetId) as Array<{ entity_id: string; blocked_id: string }>;
	const events = [];
	for (const blocker of blockers) {
		ctx.db
			.prepare(
				`UPDATE blockers SET state = 'resolved', resolved_at = ?, resolved_summary = ?,
				 resolution_source_refs = ? WHERE entity_id = ?`
			)
			.run(
				ctx.now,
				`Question ${ctx.targetId} was answered`,
				JSON.stringify([
					{ kind: 'work_event', ref: answerEventRef, label: 'Authoritative answer' }
				]),
				blocker.entity_id
			);
		ctx.db
			.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
			.run(ctx.now, blocker.entity_id);
		events.push({
			event_type: 'blocker_resolved',
			subject_type: 'blocker',
			subject_id: blocker.entity_id,
			summary: `Resolved blocker on ${blocker.blocked_id}: Question ${ctx.targetId} answered`,
			payload: { blocked_id: blocker.blocked_id, question_id: ctx.targetId! }
		});
	}
	return events;
}

export function registerQuestionCommands(): void {
	registerCommand({
		name: 'create_question',
		targetType: null,
		summary: 'Create a Question (missing knowledge that materially affects work)',
		requiresTarget: false,
		validate: (payload) => {
			const text = requireString(payload, 'question', { maxLength: 500 });
			if (!text.endsWith('?')) {
				throw new Work3Error(
					'validation_failed',
					'question must be syntactically explicit (end with "?")'
				);
			}
			requireString(payload, 'area_id');
			optionalEnum(payload, 'priority', TASK_PRIORITIES);
		},
		execute: (ctx) => {
			const areaId = requireString(ctx.payload, 'area_id');
			requireActiveArea(ctx.db, areaId);
			const text = requireString(ctx.payload, 'question', { maxLength: 500 });
			const id = allocateEntityId(ctx.db, 'question');
			insertEntity(ctx.db, { id, type: 'question', areaId, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO questions (entity_id, question, context, impact, priority, steward, answerable_by, working_hypothesis, target_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					text,
					optionalString(ctx.payload, 'context') ?? null,
					optionalString(ctx.payload, 'impact') ?? null,
					optionalEnum(ctx.payload, 'priority', TASK_PRIORITIES) ?? null,
					optionalString(ctx.payload, 'steward') ?? null,
					parseIdentityList(ctx.payload, 'answerable_by') ?? '[]',
					parseHypothesis(ctx.payload) ?? null,
					optionalNumber(ctx.payload, 'target_at') ?? null
				);
			return {
				result: { id, question: text, status: 'open' },
				events: [
					{
						event_type: 'question_created',
						subject_type: 'question',
						subject_id: id,
						summary: `Created Question ${id}: ${text}`,
						version_from: null,
						version_to: 1,
						payload: { question: text, area_id: areaId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'update_question',
		targetType: 'question',
		summary: 'Edit Question context/impact/steward fields (never lifecycle)',
		requiresTarget: true,
		validate: (payload) => {
			optionalEnum(payload, 'priority', TASK_PRIORITIES);
		},
		guards: [
			(ctx) => {
				const row = question(ctx);
				if (row.status === 'withdrawn') {
					throw new Work3Error('transition_not_allowed', 'Withdrawn Questions reject edits', {
						alternatives: ['reopen_question']
					});
				}
			}
		],
		execute: (ctx) => {
			const row = question(ctx);
			const hypothesis = parseHypothesis(ctx.payload);
			const next = {
				context:
					ctx.payload.context === undefined
						? row.context
						: (optionalString(ctx.payload, 'context') ?? null),
				impact:
					ctx.payload.impact === undefined
						? row.impact
						: (optionalString(ctx.payload, 'impact') ?? null),
				priority:
					ctx.payload.priority === undefined
						? row.priority
						: (optionalEnum(ctx.payload, 'priority', TASK_PRIORITIES) ?? null),
				steward:
					ctx.payload.steward === undefined
						? row.steward
						: (optionalString(ctx.payload, 'steward') ?? null),
				answerable_by: parseIdentityList(ctx.payload, 'answerable_by') ?? row.answerable_by,
				working_hypothesis: hypothesis === undefined ? row.working_hypothesis : hypothesis,
				target_at:
					ctx.payload.target_at === undefined
						? row.target_at
						: (optionalNumber(ctx.payload, 'target_at') ?? null)
			};
			const changed = (Object.keys(next) as Array<keyof typeof next>).filter(
				(key) => next[key] !== row[key]
			);
			if (changed.length === 0) {
				return { result: { id: row.entity_id }, events: [], noop: true };
			}
			ctx.db
				.prepare(
					`UPDATE questions SET context = ?, impact = ?, priority = ?, steward = ?, answerable_by = ?,
					 working_hypothesis = ?, target_at = ? WHERE entity_id = ?`
				)
				.run(
					next.context,
					next.impact,
					next.priority,
					next.steward,
					next.answerable_by,
					next.working_hypothesis,
					next.target_at,
					row.entity_id
				);
			return {
				result: { id: row.entity_id, changed },
				events: [
					{
						event_type: 'question_updated',
						subject_type: 'question',
						subject_id: row.entity_id,
						summary: `Updated Question ${row.entity_id}`,
						payload: { changed_fields: changed }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'answer_question',
		targetType: 'question',
		summary: 'Answer a Question (immutable answer revision; supported answers need sources)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'answer');
			requireEnum(payload, 'confidence', ANSWER_CONFIDENCES);
		},
		execute: (ctx) => {
			const row = question(ctx);
			const answer = requireString(ctx.payload, 'answer');
			const confidence = requireEnum(ctx.payload, 'confidence', ANSWER_CONFIDENCES);
			const isHumanSource = ctx.actor.kind === 'person';
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs, {
				// Supported/confirmed factual answers require sources; a person's own
				// authoritative statement stands as the recorded human source.
				required: confidence !== 'tentative' && !isHumanSource
			});
			if (row.status === 'withdrawn') {
				throw new Work3Error('transition_not_allowed', 'Withdrawn Questions cannot be answered', {
					alternatives: ['reopen_question']
				});
			}
			const existing = currentAnswer(ctx.db, row.entity_id);
			if (
				row.status === 'answered' &&
				existing &&
				existing.answer === answer &&
				existing.answerer_kind === ctx.actor.kind &&
				existing.answerer_id === ctx.actor.id
			) {
				// Repeating the same answer from the same authoritative source.
				return {
					result: { id: row.entity_id, status: 'answered', answer_id: existing.id },
					events: [],
					noop: true
				};
			}
			const revision = appendRevision(ctx.db, 'question_answers', {
				parentId: row.entity_id,
				now: ctx.now,
				columns: {
					answer,
					answerer_kind: ctx.actor.kind,
					answerer_id: ctx.actor.id,
					answerer_label: ctx.actor.label,
					confidence,
					source_refs: JSON.stringify(sourceRefs)
				}
			});
			ctx.db
				.prepare(`UPDATE questions SET status = 'answered' WHERE entity_id = ?`)
				.run(row.entity_id);
			const answerEvent = {
				event_type: 'question_answered',
				subject_type: 'question',
				subject_id: row.entity_id,
				summary: `Answered Question ${row.entity_id} (${confidence})`,
				payload: { answer_id: revision.id, confidence, supersedes: revision.supersedes },
				source_refs: sourceRefs
			};
			const blockerEvents = autoResolveQuestionBlockers(ctx, revision.id);
			return {
				result: { id: row.entity_id, status: 'answered', answer_id: revision.id },
				events: [answerEvent, ...blockerEvents]
			};
		}
	});

	registerCommand({
		name: 'revise_answer',
		targetType: 'question',
		summary: 'Revise an answer (prior revision preserved; lifecycle stays answered)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'answer');
			requireEnum(payload, 'confidence', ANSWER_CONFIDENCES);
		},
		execute: (ctx) => {
			const row = question(ctx);
			if (row.status !== 'answered') {
				throw new Work3Error(
					'transition_not_allowed',
					'Only answered Questions have answers to revise',
					{
						details: { status: row.status },
						alternatives: ['answer_question']
					}
				);
			}
			const answer = requireString(ctx.payload, 'answer');
			const confidence = requireEnum(ctx.payload, 'confidence', ANSWER_CONFIDENCES);
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs, {
				required: confidence !== 'tentative' && ctx.actor.kind !== 'person'
			});
			const revision = appendRevision(ctx.db, 'question_answers', {
				parentId: row.entity_id,
				now: ctx.now,
				columns: {
					answer,
					answerer_kind: ctx.actor.kind,
					answerer_id: ctx.actor.id,
					answerer_label: ctx.actor.label,
					confidence,
					source_refs: JSON.stringify(sourceRefs)
				}
			});
			return {
				result: { id: row.entity_id, status: 'answered', answer_id: revision.id },
				events: [
					{
						event_type: 'answer_revised',
						subject_type: 'question',
						subject_id: row.entity_id,
						summary: `Revised answer for Question ${row.entity_id}`,
						payload: { answer_id: revision.id, supersedes: revision.supersedes, confidence },
						source_refs: sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'withdraw_question',
		targetType: 'question',
		summary: 'Withdraw an unanswered Question (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = question(ctx);
			if (row.status === 'withdrawn') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'open') {
				throw new Work3Error(
					'transition_not_allowed',
					'Withdrawal applies only to unanswered Questions',
					{
						details: { status: row.status },
						alternatives: ['reopen_question']
					}
				);
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE questions SET status = 'withdrawn', withdrawn_at = ?, withdraw_reason = ? WHERE entity_id = ?`
				)
				.run(ctx.now, reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'withdrawn' },
				events: [
					{
						event_type: 'question_withdrawn',
						subject_type: 'question',
						subject_id: row.entity_id,
						summary: `Withdrew Question ${row.entity_id}: ${reason}`,
						payload: { reason }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'reopen_question',
		targetType: 'question',
		summary: 'Reopen an answered/withdrawn Question (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = question(ctx);
			if (row.status === 'open') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE questions SET status = 'open', withdrawn_at = NULL, withdraw_reason = NULL WHERE entity_id = ?`
				)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, status: 'open' },
				events: [
					{
						event_type: 'question_reopened',
						subject_type: 'question',
						subject_id: row.entity_id,
						summary: `Reopened Question ${row.entity_id}: ${reason}`,
						payload: { reason, prior_status: row.status }
					}
				]
			};
		}
	});
}
