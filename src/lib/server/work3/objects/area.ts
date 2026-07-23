import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { registerCommand } from '../engine/registry.js';
import { optionalString, requireString } from '../engine/validate.js';

/**
 * Area commands (docs 01–02): active ↔ archived with explicit restoration.
 * Areas are flat, have no owner, and archiving never changes contained Work.
 */

export interface AreaRow {
	entity_id: string;
	title: string;
	summary: string | null;
	state: 'active' | 'archived';
	archived_at: number | null;
	merged_into: string | null;
}

export function loadArea(db: Database.Database, id: string): AreaRow | null {
	return (db.prepare('SELECT * FROM areas WHERE entity_id = ?').get(id) as AreaRow) ?? null;
}

/** Guard helper shared by Work-creation commands: the Area must accept Work. */
export function requireActiveArea(db: Database.Database, areaId: string): AreaRow {
	const envelope = loadEntity(db, areaId);
	if (!envelope || envelope.type !== 'area') {
		throw new Work3Error('validation_failed', `No such Area: ${areaId}`, {
			details: { field: 'area_id', area_id: areaId }
		});
	}
	const area = loadArea(db, areaId);
	if (!area || area.state !== 'active') {
		throw new Work3Error('invariant_violation', `Area ${areaId} is archived and rejects new Work`, {
			details: { area_id: areaId },
			alternatives: ['restore_area']
		});
	}
	return area;
}

function countActiveAssignedWork(db: Database.Database, areaId: string): number {
	const row = db
		.prepare(
			`SELECT COUNT(*) AS count FROM entities e
			 JOIN tasks t ON t.entity_id = e.id
			 WHERE e.area_id = ? AND t.status NOT IN ('completed','cancelled')`
		)
		.get(areaId) as { count: number };
	return row.count;
}

export function registerAreaCommands(): void {
	registerCommand({
		name: 'create_area',
		targetType: null,
		summary: 'Create an Area (durable sphere of responsibility)',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'title', { maxLength: 200 });
		},
		execute: (ctx) => {
			const title = requireString(ctx.payload, 'title', { maxLength: 200 });
			const summary = optionalString(ctx.payload, 'summary') ?? null;
			const id = allocateEntityId(ctx.db, 'area');
			insertEntity(ctx.db, { id, type: 'area', now: ctx.now });
			ctx.db
				.prepare('INSERT INTO areas (entity_id, title, summary) VALUES (?, ?, ?)')
				.run(id, title, summary);
			return {
				result: { id, title, state: 'active' },
				events: [
					{
						event_type: 'area_created',
						subject_type: 'area',
						subject_id: id,
						summary: `Created Area "${title}" (${id})`,
						version_from: null,
						version_to: 1,
						payload: { title }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'update_area',
		targetType: 'area',
		summary: 'Edit Area title/summary (never lifecycle)',
		requiresTarget: true,
		guards: [
			(ctx) => {
				const area = loadArea(ctx.db, ctx.targetId!)!;
				if (area.state === 'archived') {
					throw new Work3Error(
						'transition_not_allowed',
						'Archived Areas reject ordinary mutations',
						{
							details: { state: area.state },
							alternatives: ['restore_area']
						}
					);
				}
			}
		],
		execute: (ctx) => {
			const area = loadArea(ctx.db, ctx.targetId!)!;
			const title = optionalString(ctx.payload, 'title') ?? area.title;
			const summary =
				ctx.payload.summary === undefined
					? area.summary
					: (optionalString(ctx.payload, 'summary') ?? null);
			if (title === area.title && summary === area.summary) {
				return { result: { id: area.entity_id, title, summary }, events: [], noop: true };
			}
			ctx.db
				.prepare('UPDATE areas SET title = ?, summary = ? WHERE entity_id = ?')
				.run(title, summary, area.entity_id);
			return {
				result: { id: area.entity_id, title, summary },
				events: [
					{
						event_type: 'area_updated',
						subject_type: 'area',
						subject_id: area.entity_id,
						summary: `Updated Area ${area.entity_id}`,
						payload: { title, summary }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'archive_area',
		targetType: 'area',
		summary: 'Archive an Area (Work must be reassigned or explicitly excepted)',
		requiresTarget: true,
		execute: (ctx) => {
			const area = loadArea(ctx.db, ctx.targetId!)!;
			if (area.state === 'archived') {
				return { result: { id: area.entity_id, state: 'archived' }, events: [], noop: true };
			}
			const activeWork = countActiveAssignedWork(ctx.db, area.entity_id);
			const exception = optionalString(ctx.payload, 'exception_reason');
			if (activeWork > 0 && !exception) {
				throw new Work3Error(
					'transition_requirements_not_met',
					`Area has ${activeWork} active Work item(s); reassign them or provide exception_reason`,
					{ details: { active_work_count: activeWork, missing: ['exception_reason'] } }
				);
			}
			ctx.db
				.prepare(`UPDATE areas SET state = 'archived', archived_at = ? WHERE entity_id = ?`)
				.run(ctx.now, area.entity_id);
			return {
				result: { id: area.entity_id, state: 'archived' },
				events: [
					{
						event_type: 'area_archived',
						subject_type: 'area',
						subject_id: area.entity_id,
						summary: `Archived Area "${area.title}" (${area.entity_id})`,
						payload: exception ? { exception_reason: exception, active_work_count: activeWork } : {}
					}
				]
			};
		}
	});

	registerCommand({
		name: 'restore_area',
		targetType: 'area',
		summary: 'Restore an archived Area to active',
		requiresTarget: true,
		execute: (ctx) => {
			const area = loadArea(ctx.db, ctx.targetId!)!;
			if (area.state === 'active') {
				return { result: { id: area.entity_id, state: 'active' }, events: [], noop: true };
			}
			ctx.db
				.prepare(`UPDATE areas SET state = 'active', archived_at = NULL WHERE entity_id = ?`)
				.run(area.entity_id);
			return {
				result: { id: area.entity_id, state: 'active' },
				events: [
					{
						event_type: 'area_restored',
						subject_type: 'area',
						subject_id: area.entity_id,
						summary: `Restored Area "${area.title}" (${area.entity_id})`
					}
				]
			};
		}
	});
}
