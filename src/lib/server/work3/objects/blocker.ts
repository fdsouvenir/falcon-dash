import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { registerCommand } from '../engine/registry.js';
import { optionalString, requireEnum, requireString } from '../engine/validate.js';
import { loadTask } from './task.js';

/**
 * Blocker relationship (doc 03): an explicit historical record of what
 * prevents actionable Work from proceeding. active → resolved | invalidated.
 * Blocking never rewrites the blocked object's lifecycle — blocked state is
 * derived from active Blockers on read.
 */

export const BLOCKER_SOURCE_KINDS = ['work', 'person', 'agent', 'system', 'external'] as const;

/** Object types that may be directly blocked (doc 01). Grows with new slices. */
const BLOCKABLE_TYPES = ['task', 'question', 'decision', 'change_request', 'automaton'];

export interface BlockerRow {
	entity_id: string;
	blocked_id: string;
	source_kind: (typeof BLOCKER_SOURCE_KINDS)[number];
	source_work_id: string | null;
	source_label: string | null;
	reason: string;
	resolution_condition: string;
	unblock_task_id: string | null;
	state: 'active' | 'resolved' | 'invalidated';
	resolved_at: number | null;
	resolved_summary: string | null;
	resolution_source_refs: string;
	invalidated_at: number | null;
	invalidated_reason: string | null;
}

export function loadBlocker(db: Database.Database, id: string): BlockerRow | null {
	return (db.prepare('SELECT * FROM blockers WHERE entity_id = ?').get(id) as BlockerRow) ?? null;
}

export function registerBlockerCommands(): void {
	registerCommand({
		name: 'create_blocker',
		targetType: null,
		summary: 'Record an explicit constraint preventing actionable Work from proceeding',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'blocked_id');
			requireEnum(payload, 'source_kind', BLOCKER_SOURCE_KINDS);
			requireString(payload, 'reason');
			requireString(payload, 'resolution_condition');
		},
		execute: (ctx) => {
			const blockedId = requireString(ctx.payload, 'blocked_id');
			const sourceKind = requireEnum(ctx.payload, 'source_kind', BLOCKER_SOURCE_KINDS);
			const reason = requireString(ctx.payload, 'reason');
			const resolutionCondition = requireString(ctx.payload, 'resolution_condition');
			const sourceWorkId = optionalString(ctx.payload, 'source_work_id') ?? null;
			const sourceLabel = optionalString(ctx.payload, 'source_label') ?? null;
			const unblockTaskId = optionalString(ctx.payload, 'unblock_task_id') ?? null;

			const blocked = loadEntity(ctx.db, blockedId);
			if (!blocked) {
				throw new Work3Error('not_found', `No such object to block: ${blockedId}`);
			}
			if (!BLOCKABLE_TYPES.includes(blocked.type)) {
				throw new Work3Error(
					'invariant_violation',
					`Only actionable Work may be blocked (got ${blocked.type})`,
					{ details: { blocked_id: blockedId, type: blocked.type, blockable: BLOCKABLE_TYPES } }
				);
			}
			if (blocked.type === 'task') {
				const row = loadTask(ctx.db, blockedId);
				if (row && (row.status === 'completed' || row.status === 'cancelled')) {
					throw new Work3Error('invariant_violation', 'Terminal Work cannot be blocked', {
						details: { blocked_id: blockedId, status: row.status }
					});
				}
			}
			if (sourceKind === 'work') {
				if (!sourceWorkId) {
					throw new Work3Error(
						'validation_failed',
						'source_work_id is required when source_kind is work'
					);
				}
				if (sourceWorkId === blockedId) {
					throw new Work3Error('invariant_violation', 'An item cannot block itself', {
						details: { blocked_id: blockedId }
					});
				}
				if (!loadEntity(ctx.db, sourceWorkId)) {
					throw new Work3Error('not_found', `No such blocking Work: ${sourceWorkId}`);
				}
			} else if (!sourceLabel) {
				throw new Work3Error(
					'validation_failed',
					'source_label is required for non-Work blocker sources'
				);
			}
			if (unblockTaskId && !loadEntity(ctx.db, unblockTaskId)) {
				throw new Work3Error('not_found', `No such unblock Task: ${unblockTaskId}`);
			}

			// Duplicate active blocker (same blocked target + same source) is an
			// idempotent no-op returning the existing record.
			const duplicate = ctx.db
				.prepare(
					`SELECT entity_id FROM blockers
					 WHERE blocked_id = ? AND state = 'active' AND source_kind = ?
					   AND COALESCE(source_work_id, '') = COALESCE(?, '')
					   AND COALESCE(source_label, '') = COALESCE(?, '')`
				)
				.get(blockedId, sourceKind, sourceWorkId, sourceLabel) as { entity_id: string } | undefined;
			if (duplicate) {
				return {
					result: { id: duplicate.entity_id, blocked_id: blockedId, state: 'active' },
					events: [],
					noop: true
				};
			}

			const id = allocateEntityId(ctx.db, 'blocker');
			insertEntity(ctx.db, { id, type: 'blocker', areaId: blocked.area_id, now: ctx.now });
			ctx.db
				.prepare(
					`INSERT INTO blockers (entity_id, blocked_id, source_kind, source_work_id, source_label,
					 reason, resolution_condition, unblock_task_id)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					blockedId,
					sourceKind,
					sourceWorkId,
					sourceLabel,
					reason,
					resolutionCondition,
					unblockTaskId
				);
			return {
				result: { id, blocked_id: blockedId, state: 'active' },
				events: [
					{
						event_type: 'blocker_created',
						subject_type: 'blocker',
						subject_id: id,
						summary: `Blocked ${blockedId}: ${reason}`,
						version_from: null,
						version_to: 1,
						payload: { blocked_id: blockedId, source_kind: sourceKind, reason }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'resolve_blocker',
		targetType: 'blocker',
		summary: 'Resolve a blocker (requires a summary of what cleared it)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'summary');
		},
		execute: (ctx) => {
			const row = loadBlocker(ctx.db, ctx.targetId!)!;
			if (row.state === 'resolved') {
				return { result: { id: row.entity_id, state: row.state }, events: [], noop: true };
			}
			if (row.state !== 'active') {
				throw new Work3Error('transition_not_allowed', `Cannot resolve a ${row.state} blocker`, {
					details: { state: row.state }
				});
			}
			const summary = requireString(ctx.payload, 'summary');
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs);
			ctx.db
				.prepare(
					`UPDATE blockers SET state = 'resolved', resolved_at = ?, resolved_summary = ?,
					 resolution_source_refs = ? WHERE entity_id = ?`
				)
				.run(ctx.now, summary, JSON.stringify(sourceRefs), row.entity_id);
			return {
				result: { id: row.entity_id, state: 'resolved', blocked_id: row.blocked_id },
				events: [
					{
						event_type: 'blocker_resolved',
						subject_type: 'blocker',
						subject_id: row.entity_id,
						summary: `Resolved blocker on ${row.blocked_id}: ${summary}`,
						payload: { blocked_id: row.blocked_id, summary },
						source_refs: sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'invalidate_blocker',
		targetType: 'blocker',
		summary: 'Invalidate a blocker that was wrong or ceased to apply',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = loadBlocker(ctx.db, ctx.targetId!)!;
			if (row.state === 'invalidated') {
				return { result: { id: row.entity_id, state: row.state }, events: [], noop: true };
			}
			if (row.state !== 'active') {
				throw new Work3Error('transition_not_allowed', `Cannot invalidate a ${row.state} blocker`, {
					details: { state: row.state }
				});
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE blockers SET state = 'invalidated', invalidated_at = ?, invalidated_reason = ?
					 WHERE entity_id = ?`
				)
				.run(ctx.now, reason, row.entity_id);
			return {
				result: { id: row.entity_id, state: 'invalidated', blocked_id: row.blocked_id },
				events: [
					{
						event_type: 'blocker_invalidated',
						subject_type: 'blocker',
						subject_id: row.entity_id,
						summary: `Invalidated blocker on ${row.blocked_id}: ${reason}`,
						payload: { blocked_id: row.blocked_id, reason }
					}
				]
			};
		}
	});
}
