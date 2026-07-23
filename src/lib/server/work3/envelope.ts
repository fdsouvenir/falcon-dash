import type Database from 'better-sqlite3';
import type { EntityEnvelope } from '$lib/work3-shared/types.js';
import { formatPublicId, type Work3EntityType } from '$lib/work3-shared/ids.js';

/**
 * Minimal shared entity envelope (doc 01): id, type, area_id, timestamps,
 * version. Type-specific tables own all business fields and reference
 * entities(id). All helpers are synchronous and must run inside the engine's
 * transaction.
 */

export function allocateEntityId(db: Database.Database, type: Work3EntityType): string {
	const row = db
		.prepare(
			`INSERT INTO id_counters (type, next_seq) VALUES (?, 2)
			 ON CONFLICT(type) DO UPDATE SET next_seq = next_seq + 1
			 RETURNING next_seq`
		)
		.get(type) as { next_seq: number };
	return formatPublicId(type, row.next_seq - 1);
}

export function insertEntity(
	db: Database.Database,
	params: { id: string; type: string; areaId?: string | null; now: number }
): EntityEnvelope {
	db.prepare(
		`INSERT INTO entities (id, type, area_id, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, 1)`
	).run(params.id, params.type, params.areaId ?? null, params.now, params.now);
	return {
		id: params.id,
		type: params.type,
		area_id: params.areaId ?? null,
		created_at: params.now,
		updated_at: params.now,
		version: 1
	};
}

export function loadEntity(db: Database.Database, id: string): EntityEnvelope | null {
	const row = db
		.prepare('SELECT id, type, area_id, created_at, updated_at, version FROM entities WHERE id = ?')
		.get(id) as EntityEnvelope | undefined;
	return row ?? null;
}

/**
 * Optimistically bump the envelope version. Returns the new version, or null
 * if the row no longer carries `fromVersion` (a same-transaction logic error —
 * the engine treats it as an invariant violation, since the expected_version
 * check already passed inside this transaction).
 */
export function bumpEntityVersion(
	db: Database.Database,
	id: string,
	fromVersion: number,
	now: number
): number | null {
	const result = db
		.prepare(
			'UPDATE entities SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?'
		)
		.run(now, id, fromVersion);
	return result.changes === 1 ? fromVersion + 1 : null;
}

export function updateEntityArea(db: Database.Database, id: string, areaId: string | null): void {
	db.prepare('UPDATE entities SET area_id = ? WHERE id = ?').run(areaId, id);
}
