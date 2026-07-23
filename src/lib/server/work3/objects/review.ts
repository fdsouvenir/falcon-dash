import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { registerCommand, type DomainEventInput } from '../engine/registry.js';
import { requireEnum, requireString } from '../engine/validate.js';
import { hasRequiredComments } from '../read/governance-derived.js';
import { currentPlanRevision } from './plan.js';
import { loadTask } from './task.js';

/**
 * Review artifact (docs 01–02): one immutable point-in-time outcome targeting
 * an exact subject revision. Reconsideration creates another Review; current
 * disposition is derived. Review NEVER grants execution authority.
 */

export const REVIEW_OUTCOMES = ['approved', 'changes_requested', 'rejected', 'commented'] as const;

const REVIEWABLE_TYPES = ['plan', 'task', 'change_request'];

interface ReviewComment {
	section?: string;
	text: string;
	severity: 'required' | 'advisory';
}

function parseComments(payload: Record<string, unknown>): ReviewComment[] {
	const raw = payload.comments;
	if (raw === undefined) return [];
	if (!Array.isArray(raw)) throw new Work3Error('validation_failed', 'comments must be an array');
	return raw.map((entry, index) => {
		if (!entry || typeof entry !== 'object') {
			throw new Work3Error('validation_failed', `comments[${index}] must be an object`);
		}
		const candidate = entry as Record<string, unknown>;
		if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
			throw new Work3Error('validation_failed', `comments[${index}].text is required`);
		}
		if (candidate.severity !== 'required' && candidate.severity !== 'advisory') {
			throw new Work3Error(
				'validation_failed',
				`comments[${index}].severity must be required|advisory`
			);
		}
		return {
			...(typeof candidate.section === 'string' ? { section: candidate.section } : {}),
			text: candidate.text,
			severity: candidate.severity
		};
	});
}

export function registerReviewCommands(): void {
	registerCommand({
		name: 'create_review',
		targetType: null,
		summary: 'Record an immutable Review of an exact subject revision',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'subject_id');
			requireString(payload, 'subject_revision');
			requireEnum(payload, 'outcome', REVIEW_OUTCOMES);
			requireString(payload, 'summary');
			parseComments(payload);
		},
		execute: (ctx) => {
			const subjectId = requireString(ctx.payload, 'subject_id');
			const subjectRevision = requireString(ctx.payload, 'subject_revision');
			const outcome = requireEnum(ctx.payload, 'outcome', REVIEW_OUTCOMES);
			const summary = requireString(ctx.payload, 'summary');
			const comments = parseComments(ctx.payload);
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs);

			const subject = loadEntity(ctx.db, subjectId);
			if (!subject) throw new Work3Error('not_found', `No such review subject: ${subjectId}`);
			if (!REVIEWABLE_TYPES.includes(subject.type)) {
				throw new Work3Error('invariant_violation', `${subject.type} is not reviewable`, {
					details: { reviewable: REVIEWABLE_TYPES }
				});
			}

			// A Review always targets an exact immutable current revision (doc 01):
			// superseded revisions cannot receive new Reviews.
			if (subject.type === 'plan') {
				const current = currentPlanRevision(ctx.db, subjectId);
				if (!current || current.state !== 'submitted') {
					throw new Work3Error(
						'transition_requirements_not_met',
						'Plan Reviews target the submitted current revision; this Plan has none',
						{ details: { current_state: current?.state ?? 'none' } }
					);
				}
				if (current.id !== subjectRevision) {
					throw new Work3Error(
						'invariant_violation',
						'Superseded revisions cannot receive new Reviews',
						{
							details: { current_revision: current.id, requested_revision: subjectRevision }
						}
					);
				}
			} else if (subject.type === 'task') {
				const task = loadTask(ctx.db, subjectId)!;
				if (String(task.output_revision) !== subjectRevision) {
					throw new Work3Error(
						'invariant_violation',
						'Reviews target the current output revision',
						{
							details: {
								current_revision: String(task.output_revision),
								requested_revision: subjectRevision
							}
						}
					);
				}
			} else if (subject.type === 'change_request') {
				const current = ctx.db
					.prepare(`SELECT id FROM change_revisions WHERE parent_id = ? AND is_current = 1`)
					.get(subjectId) as { id: string } | undefined;
				if (!current || current.id !== subjectRevision) {
					throw new Work3Error(
						'invariant_violation',
						'Reviews target the current Change revision',
						{
							details: {
								current_revision: current?.id ?? 'none',
								requested_revision: subjectRevision
							}
						}
					);
				}
			}

			// Required comments must be resolved in a NEW revision before approval.
			if (outcome === 'approved' && hasRequiredComments(ctx.db, subjectId, subjectRevision)) {
				throw new Work3Error(
					'invariant_violation',
					'This revision has required review comments; resolve them in a new revision before approval',
					{ alternatives: subject.type === 'plan' ? ['revise_plan'] : [] }
				);
			}
			if (outcome === 'approved' && comments.some((comment) => comment.severity === 'required')) {
				throw new Work3Error(
					'validation_failed',
					'An approving Review cannot itself carry required comments'
				);
			}

			const id = allocateEntityId(ctx.db, 'review');
			insertEntity(ctx.db, { id, type: 'review', areaId: subject.area_id, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO reviews (entity_id, subject_type, subject_id, subject_revision, outcome,
					 summary, comments, source_refs, reviewer_kind, reviewer_id, reviewer_label, submitted_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					subject.type,
					subjectId,
					subjectRevision,
					outcome,
					summary,
					JSON.stringify(comments),
					JSON.stringify(sourceRefs),
					ctx.actor.kind,
					ctx.actor.id,
					ctx.actor.label,
					ctx.now
				);

			const events: DomainEventInput[] = [
				{
					event_type: 'review_created',
					subject_type: 'review',
					subject_id: id,
					summary: `Review ${id}: ${outcome} — ${subject.type} ${subjectId} (${summary})`,
					version_from: null,
					version_to: 1,
					payload: { subject_id: subjectId, subject_revision: subjectRevision, outcome },
					source_refs: sourceRefs
				}
			];

			// Deterministic effect (doc 02): changes requested on an in_review Task
			// returns it to in_progress. Never rewrites any other lifecycle.
			if (subject.type === 'task' && outcome === 'changes_requested') {
				const task = loadTask(ctx.db, subjectId)!;
				if (task.status === 'in_review') {
					const taskEnvelope = loadEntity(ctx.db, subjectId)!;
					ctx.db
						.prepare(`UPDATE tasks SET status = 'in_progress' WHERE entity_id = ?`)
						.run(subjectId);
					ctx.db
						.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
						.run(ctx.now, subjectId);
					events.push({
						event_type: 'task_returned_to_progress',
						subject_type: 'task',
						subject_id: subjectId,
						summary: `Task ${subjectId} returned to in_progress (changes requested)`,
						version_from: taskEnvelope.version,
						version_to: taskEnvelope.version + 1,
						payload: { review_id: id, subject_revision: subjectRevision, outcome },
						source_refs: []
					});
				}
			}

			return {
				result: { id, subject_id: subjectId, subject_revision: subjectRevision, outcome },
				events
			};
		}
	});
}
