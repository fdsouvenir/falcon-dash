import type { ExecuteContext, DomainEventInput } from '../engine/registry.js';

/**
 * Deterministic reconciliation on terminal/superseded records (doc 03):
 * current-next pointers, active Blockers, and revision-pinned assertions.
 * Reconciliation never silently completes or cancels other Work; ambiguous
 * cases stay visible (a Project without a next item surfaces as unknown
 * health / Needs Resolution) and every effect emits an audit event.
 */

export type TerminalKind =
	| 'completed'
	| 'cancelled'
	| 'answered'
	| 'withdrawn'
	| 'decided'
	| 'succeeded'
	| 'rolled_back';

/** Terminal kinds that count as a supportive result (auto-resolve blockers). */
const SUPPORTIVE: TerminalKind[] = ['completed', 'answered', 'decided', 'succeeded'];

export function reconcileTerminal(
	ctx: ExecuteContext,
	entityId: string,
	kind: TerminalKind
): DomainEventInput[] {
	const events: DomainEventInput[] = [];

	// 1. Projects pointing at this record as current-next: clear the pointer.
	//    The Project deliberately becomes "no next item" — an explicit,
	//    actionable inconsistency, never a silent substitution.
	const projects = ctx.db
		.prepare(`SELECT entity_id FROM projects WHERE current_next_item_id = ?`)
		.all(entityId) as Array<{ entity_id: string }>;
	for (const project of projects) {
		ctx.db
			.prepare(`UPDATE projects SET current_next_item_id = NULL WHERE entity_id = ?`)
			.run(project.entity_id);
		ctx.db
			.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
			.run(ctx.now, project.entity_id);
		events.push({
			event_type: 'project_next_item_cleared',
			subject_type: 'project',
			subject_id: project.entity_id,
			summary: `Cleared current next item on ${project.entity_id}: ${entityId} became ${kind} — pick a new next item`,
			payload: { cleared_item: entityId, item_terminal_kind: kind }
		});
	}

	// 2. Active Blockers sourced from this record: a supportive terminal result
	//    auto-resolves them; anything else is ambiguous and stays active for
	//    explicit resolution.
	if (SUPPORTIVE.includes(kind)) {
		const blockers = ctx.db
			.prepare(
				`SELECT entity_id, blocked_id FROM blockers
				 WHERE source_kind = 'work' AND source_work_id = ? AND state = 'active'`
			)
			.all(entityId) as Array<{ entity_id: string; blocked_id: string }>;
		for (const blocker of blockers) {
			ctx.db
				.prepare(
					`UPDATE blockers SET state = 'resolved', resolved_at = ?, resolved_summary = ?,
					 resolution_source_refs = ? WHERE entity_id = ?`
				)
				.run(
					ctx.now,
					`Blocking Work ${entityId} ${kind}`,
					JSON.stringify([{ kind: 'work_event', ref: entityId, label: `Blocking Work ${kind}` }]),
					blocker.entity_id
				);
			ctx.db
				.prepare('UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ?')
				.run(ctx.now, blocker.entity_id);
			events.push({
				event_type: 'blocker_resolved',
				subject_type: 'blocker',
				subject_id: blocker.entity_id,
				summary: `Resolved blocker on ${blocker.blocked_id}: blocking Work ${entityId} ${kind}`,
				payload: { blocked_id: blocker.blocked_id, source_work_id: entityId, terminal_kind: kind }
			});
		}
	}

	return events;
}

/**
 * Revision invalidation (doc 03): when a record's supporting result is
 * reopened/reverted, its revision-pinned `satisfies` assertions no longer
 * count as proof until renewed.
 */
export function invalidateSatisfiesFrom(
	ctx: ExecuteContext,
	sourceId: string,
	reason: string
): DomainEventInput[] {
	const links = ctx.db
		.prepare(
			`SELECT id, target_id, criterion_id FROM relationships
			 WHERE source_id = ? AND rel_type = 'satisfies' AND removed_at IS NULL AND invalidated_at IS NULL`
		)
		.all(sourceId) as Array<{ id: string; target_id: string; criterion_id: string | null }>;
	const events: DomainEventInput[] = [];
	for (const link of links) {
		ctx.db
			.prepare(`UPDATE relationships SET invalidated_at = ?, invalidated_reason = ? WHERE id = ?`)
			.run(ctx.now, reason, link.id);
		events.push({
			event_type: 'satisfies_invalidated',
			subject_type: 'relationship',
			subject_id: link.id,
			summary: `Invalidated satisfies assertion ${link.id} (${sourceId} → ${link.target_id}): ${reason}`,
			payload: {
				source_id: sourceId,
				target_id: link.target_id,
				criterion_id: link.criterion_id,
				reason
			}
		});
	}
	return events;
}
