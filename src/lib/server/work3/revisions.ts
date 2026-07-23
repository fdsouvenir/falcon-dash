import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { ulid } from './ulid.js';

/**
 * Immutable revision-table pattern (doc 06). Revision tables (Plan revisions,
 * Decision packages, Question answers, ...) are type-specific, but they all
 * share this shape: append-only rows keyed by ULID, a `supersedes` link to the
 * prior revision, and exactly one current revision per parent.
 *
 * A conforming table has at least:
 *   id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, supersedes TEXT,
 *   is_current INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
 * plus its type-specific payload columns. Helpers run inside the engine
 * transaction.
 */

export interface RevisionRow {
	id: string;
	parent_id: string;
	supersedes: string | null;
	is_current: number;
	created_at: number;
}

export function currentRevision<T extends RevisionRow>(
	db: Database.Database,
	table: string,
	parentId: string
): T | null {
	const row = db
		.prepare(`SELECT * FROM ${table} WHERE parent_id = ? AND is_current = 1`)
		.get(parentId) as T | undefined;
	return row ?? null;
}

/**
 * Append a new current revision, superseding the existing current one (if any).
 * Prior revisions are never mutated beyond the is_current flag; their content
 * and supersedes links are immutable history.
 */
export function appendRevision(
	db: Database.Database,
	table: string,
	params: { parentId: string; now: number; columns: Record<string, unknown> }
): { id: string; supersedes: string | null } {
	const previous = currentRevision(db, table, params.parentId);
	if (previous) {
		db.prepare(`UPDATE ${table} SET is_current = 0 WHERE id = ?`).run(previous.id);
	}
	const id = ulid(params.now);
	const columnNames = Object.keys(params.columns);
	for (const name of columnNames) {
		if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
			throw new Work3Error('invariant_violation', `Invalid revision column name: ${name}`);
		}
	}
	const sql = `INSERT INTO ${table} (id, parent_id, supersedes, is_current, created_at${columnNames
		.map((c) => `, ${c}`)
		.join('')}) VALUES (?, ?, ?, 1, ?${columnNames.map(() => ', ?').join('')})`;
	db.prepare(sql).run(
		id,
		params.parentId,
		previous?.id ?? null,
		params.now,
		...columnNames.map((c) => params.columns[c])
	);
	return { id, supersedes: previous?.id ?? null };
}

export function revisionHistory<T extends RevisionRow>(
	db: Database.Database,
	table: string,
	parentId: string
): T[] {
	return db
		.prepare(`SELECT * FROM ${table} WHERE parent_id = ? ORDER BY created_at ASC, id ASC`)
		.all(parentId) as T[];
}
