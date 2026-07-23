import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { loadEntity, updateEntityArea } from '../envelope.js';
import { registerCommand } from '../engine/registry.js';
import { optionalString, requireEnum, requireString } from '../engine/validate.js';
import { ulid } from '../ulid.js';
import { loadProject, projectCriteria } from './project.js';
import { loadPhase } from './phase-milestone.js';

/**
 * Typed semantic links (doc 03): a narrow link table, not a knowledge graph.
 * Blockers, supersession, answers, and Change authorization stay specialized
 * records. One canonical direction per relation; inverse labels are
 * projections. `related_to` is last-resort and excluded from all derived
 * calculations.
 */

export const RELATIONSHIP_TYPES = [
	'depends_on',
	'contributes_to',
	'satisfies',
	'implements',
	'derived_from',
	'related_to'
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

const WORK_TYPES = ['task', 'question', 'decision', 'change_request', 'automaton'];
const ANY = null; // any entity type

/** Allowed source → target type pairs, enforced and exposed contextually. */
const ALLOWED_PAIRS: Record<
	RelationshipType,
	{ source: string[] | null; target: string[] | null }
> = {
	depends_on: { source: WORK_TYPES, target: WORK_TYPES },
	contributes_to: { source: [...WORK_TYPES, 'project'], target: ['milestone', 'project'] },
	satisfies: { source: [...WORK_TYPES, 'finding'], target: ['milestone', 'project'] },
	implements: { source: ['task', 'change_request'], target: ['decision'] },
	derived_from: { source: ['finding', 'question', 'decision'], target: ANY },
	related_to: { source: ANY, target: ANY }
};

export interface RelationshipRow {
	id: string;
	rel_type: RelationshipType;
	source_id: string;
	target_id: string;
	criterion_id: string | null;
	source_revision: string | null;
	source_refs: string;
	created_at: number;
	created_by: string;
	removed_at: number | null;
	removed_by: string | null;
	invalidated_at: number | null;
	invalidated_reason: string | null;
}

export function activeLinks(
	db: Database.Database,
	options: { sourceId?: string; targetId?: string; relType?: string } = {}
): RelationshipRow[] {
	const clauses = ['removed_at IS NULL'];
	const params: unknown[] = [];
	if (options.sourceId) {
		clauses.push('source_id = ?');
		params.push(options.sourceId);
	}
	if (options.targetId) {
		clauses.push('target_id = ?');
		params.push(options.targetId);
	}
	if (options.relType) {
		clauses.push('rel_type = ?');
		params.push(options.relType);
	}
	return db
		.prepare(`SELECT * FROM relationships WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC`)
		.all(...params) as RelationshipRow[];
}

/** Would source → target close a depends_on cycle? BFS over active links. */
function wouldCreateDependencyCycle(
	db: Database.Database,
	sourceId: string,
	targetId: string
): boolean {
	const queue = [targetId];
	const seen = new Set<string>([targetId]);
	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === sourceId) return true;
		const next = db
			.prepare(
				`SELECT target_id FROM relationships WHERE source_id = ? AND rel_type = 'depends_on' AND removed_at IS NULL`
			)
			.all(current) as Array<{ target_id: string }>;
		for (const edge of next) {
			if (!seen.has(edge.target_id)) {
				seen.add(edge.target_id);
				queue.push(edge.target_id);
			}
		}
	}
	return false;
}

/** A terminal supporting result is required for `satisfies` (doc 03). */
function terminalSupportingState(db: Database.Database, id: string, type: string): string | null {
	if (type === 'task') {
		const row = db
			.prepare('SELECT status, output_revision FROM tasks WHERE entity_id = ?')
			.get(id) as {
			status: string;
			output_revision: number;
		};
		return row.status === 'completed' ? String(row.output_revision) : null;
	}
	if (type === 'question') {
		const row = db.prepare('SELECT status FROM questions WHERE entity_id = ?').get(id) as {
			status: string;
		};
		return row.status === 'answered' ? 'answered' : null;
	}
	if (type === 'decision') {
		const row = db.prepare('SELECT status FROM decisions WHERE entity_id = ?').get(id) as {
			status: string;
		};
		return row.status === 'decided' ? 'decided' : null;
	}
	if (type === 'change_request') {
		const row = db
			.prepare(
				'SELECT execution_state, verification_state FROM change_requests WHERE entity_id = ?'
			)
			.get(id) as { execution_state: string; verification_state: string };
		return row.execution_state === 'succeeded' &&
			['passed', 'waived'].includes(row.verification_state)
			? 'succeeded+verified'
			: null;
	}
	if (type === 'finding') {
		const row = db.prepare('SELECT validity FROM findings WHERE entity_id = ?').get(id) as {
			validity: string;
		};
		return row.validity === 'current' ? 'current' : null;
	}
	return null;
}

export function registerRelationshipCommands(): void {
	registerCommand({
		name: 'link_work',
		targetType: null,
		summary: 'Create a typed semantic link (duplicates are idempotent no-ops)',
		requiresTarget: false,
		validate: (payload) => {
			requireEnum(payload, 'rel_type', RELATIONSHIP_TYPES);
			requireString(payload, 'source_id');
			requireString(payload, 'target_id');
		},
		execute: (ctx) => {
			const relType = requireEnum(ctx.payload, 'rel_type', RELATIONSHIP_TYPES);
			const sourceId = requireString(ctx.payload, 'source_id');
			const targetId = requireString(ctx.payload, 'target_id');
			if (sourceId === targetId) {
				throw new Work3Error('invariant_violation', 'Self-links are forbidden');
			}
			const source = loadEntity(ctx.db, sourceId);
			if (!source) throw new Work3Error('not_found', `No such source: ${sourceId}`);
			const target = loadEntity(ctx.db, targetId);
			if (!target) throw new Work3Error('not_found', `No such target: ${targetId}`);

			const allowed = ALLOWED_PAIRS[relType];
			if (allowed.source && !allowed.source.includes(source.type)) {
				throw new Work3Error(
					'invariant_violation',
					`${relType} does not accept ${source.type} sources`,
					{
						details: { allowed_sources: allowed.source }
					}
				);
			}
			if (allowed.target && !allowed.target.includes(target.type)) {
				throw new Work3Error(
					'invariant_violation',
					`${relType} does not accept ${target.type} targets`,
					{
						details: { allowed_targets: allowed.target }
					}
				);
			}

			let criterionId: string | null = null;
			let sourceRevision: string | null = null;
			let sourceRefs: ReturnType<typeof parseSourceRefs>;

			if (relType === 'depends_on' && wouldCreateDependencyCycle(ctx.db, sourceId, targetId)) {
				throw new Work3Error('invariant_violation', 'depends_on cycles are invalid', {
					details: { source_id: sourceId, target_id: targetId }
				});
			}

			if (relType === 'satisfies' || relType === 'contributes_to') {
				criterionId = optionalString(ctx.payload, 'criterion_id') ?? null;
				if (target.type === 'project' && criterionId) {
					const criteria = projectCriteria(loadProject(ctx.db, targetId)!);
					if (!criteria.some((criterion) => criterion.id === criterionId)) {
						throw new Work3Error('not_found', `No such completion criterion: ${criterionId}`, {
							details: { criterion_ids: criteria.map((criterion) => criterion.id) }
						});
					}
				}
			}
			if (relType === 'satisfies') {
				if (target.type === 'project' && !criterionId) {
					throw new Work3Error('validation_failed', 'satisfies → project requires criterion_id');
				}
				// Immutable assertion: terminal supporting result + sources + pinned revision.
				sourceRevision = terminalSupportingState(ctx.db, sourceId, source.type);
				if (sourceRevision === null) {
					throw new Work3Error(
						'transition_requirements_not_met',
						'satisfies requires a terminal supporting result (completed/answered/decided/verified/current)',
						{ details: { source_id: sourceId, source_type: source.type } }
					);
				}
				sourceRefs = parseSourceRefs(ctx.payload.source_refs, { required: true });
			} else {
				sourceRefs = parseSourceRefs(ctx.payload.source_refs);
			}

			// Duplicate active links are idempotent no-ops.
			const duplicate = ctx.db
				.prepare(
					`SELECT id FROM relationships WHERE rel_type = ? AND source_id = ? AND target_id = ?
					 AND COALESCE(criterion_id, '') = COALESCE(?, '') AND removed_at IS NULL AND invalidated_at IS NULL`
				)
				.get(relType, sourceId, targetId, criterionId) as { id: string } | undefined;
			if (duplicate) {
				return { result: { id: duplicate.id, rel_type: relType }, events: [], noop: true };
			}

			const id = ulid(ctx.now);
			ctx.db
				.prepare(
					`INSERT INTO relationships (id, rel_type, source_id, target_id, criterion_id, source_revision,
					 source_refs, created_at, created_by)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					relType,
					sourceId,
					targetId,
					criterionId,
					sourceRevision,
					JSON.stringify(sourceRefs),
					ctx.now,
					`${ctx.actor.kind}:${ctx.actor.id}`
				);
			return {
				result: {
					id,
					rel_type: relType,
					source_id: sourceId,
					target_id: targetId,
					criterion_id: criterionId
				},
				events: [
					{
						event_type: 'work_linked',
						subject_type: 'relationship',
						subject_id: id,
						summary: `${sourceId} ${relType} ${targetId}${criterionId ? ` (criterion ${criterionId})` : ''}`,
						payload: {
							rel_type: relType,
							source_id: sourceId,
							target_id: targetId,
							criterion_id: criterionId
						},
						source_refs: sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'unlink_work',
		targetType: null,
		summary: 'Remove a semantic link (audited; history preserved)',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'link_id');
		},
		execute: (ctx) => {
			const linkId = requireString(ctx.payload, 'link_id');
			const row = ctx.db.prepare('SELECT * FROM relationships WHERE id = ?').get(linkId) as
				| RelationshipRow
				| undefined;
			if (!row) throw new Work3Error('not_found', `No such link: ${linkId}`);
			if (row.removed_at !== null) {
				return { result: { id: linkId, removed: true }, events: [], noop: true };
			}
			ctx.db
				.prepare(`UPDATE relationships SET removed_at = ?, removed_by = ? WHERE id = ?`)
				.run(ctx.now, `${ctx.actor.kind}:${ctx.actor.id}`, linkId);
			return {
				result: { id: linkId, removed: true },
				events: [
					{
						event_type: 'work_unlinked',
						subject_type: 'relationship',
						subject_id: linkId,
						summary: `Removed link ${linkId} (${row.source_id} ${row.rel_type} ${row.target_id})`,
						payload: {
							rel_type: row.rel_type,
							source_id: row.source_id,
							target_id: row.target_id,
							reason: optionalString(ctx.payload, 'reason') ?? null
						}
					}
				]
			};
		}
	});

	registerCommand({
		name: 'assign_to_project',
		targetType: null,
		summary: 'Assign Work to a Project (and optionally a Phase in that Project), or unassign',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'work_id');
		},
		execute: (ctx) => {
			const workId = requireString(ctx.payload, 'work_id');
			const work = loadEntity(ctx.db, workId);
			if (!work) throw new Work3Error('not_found', `No such Work item: ${workId}`);
			const tables: Record<string, string> = {
				task: 'tasks',
				question: 'questions',
				decision: 'decisions',
				change_request: 'change_requests'
			};
			const table = tables[work.type];
			if (!table) {
				throw new Work3Error('invariant_violation', `${work.type} cannot be assigned to a Project`);
			}
			const projectId = optionalString(ctx.payload, 'project_id') ?? null;
			const phaseId = optionalString(ctx.payload, 'phase_id') ?? null;
			if (phaseId && !projectId) {
				throw new Work3Error('validation_failed', 'phase_id requires project_id');
			}
			if (projectId) {
				const projectEnvelope = loadEntity(ctx.db, projectId);
				if (!projectEnvelope || projectEnvelope.type !== 'project') {
					throw new Work3Error('not_found', `No such Project: ${projectId}`);
				}
				const projectRow = loadProject(ctx.db, projectId)!;
				if (projectRow.archived_at !== null) {
					throw new Work3Error(
						'transition_not_allowed',
						'Archived Projects reject new assignments'
					);
				}
				// Project-attached Work inherits the Project Area by default.
				if (work.area_id !== projectEnvelope.area_id && projectEnvelope.area_id) {
					updateEntityArea(ctx.db, workId, projectEnvelope.area_id);
				}
			}
			if (phaseId) {
				const phase = loadPhase(ctx.db, phaseId);
				if (!phase) throw new Work3Error('not_found', `No such Phase: ${phaseId}`);
				if (phase.project_id !== projectId) {
					throw new Work3Error(
						'invariant_violation',
						`Phase ${phaseId} belongs to ${phase.project_id}, not ${projectId}`
					);
				}
			}
			const current = ctx.db
				.prepare(`SELECT project_id, phase_id FROM ${table} WHERE entity_id = ?`)
				.get(workId) as { project_id: string | null; phase_id: string | null };
			if (current.project_id === projectId && current.phase_id === phaseId) {
				return {
					result: { id: workId, project_id: projectId, phase_id: phaseId },
					events: [],
					noop: true
				};
			}
			ctx.db
				.prepare(`UPDATE ${table} SET project_id = ?, phase_id = ? WHERE entity_id = ?`)
				.run(projectId, phaseId, workId);
			// Membership change bumps the assigned work's envelope, not a target.
			ctx.db
				.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
				.run(ctx.now, workId);
			return {
				result: { id: workId, project_id: projectId, phase_id: phaseId },
				events: [
					{
						event_type: 'work_assigned',
						subject_type: work.type,
						subject_id: workId,
						summary: projectId
							? `Assigned ${workId} to ${projectId}${phaseId ? ` / ${phaseId}` : ''}`
							: `Unassigned ${workId} from its Project`,
						payload: {
							project_id: projectId,
							phase_id: phaseId,
							prior_project_id: current.project_id,
							prior_phase_id: current.phase_id
						}
					}
				]
			};
		}
	});
}
