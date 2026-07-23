import type Database from 'better-sqlite3';

/**
 * Derived state is computed on read, never stored (doc 06, release gate 2).
 * All derived computations live here so projections, guards, and queue buckets
 * cannot diverge.
 */

export interface ActiveBlockerSummary {
	id: string;
	reason: string;
	source_kind: string;
	source_label: string | null;
	source_work_id: string | null;
	resolution_condition: string;
	created_at: number;
}

/** Active blockers for one target. */
export function activeBlockersFor(
	db: Database.Database,
	blockedId: string
): ActiveBlockerSummary[] {
	return db
		.prepare(
			`SELECT b.entity_id AS id, b.reason, b.source_kind, b.source_label, b.source_work_id,
			        b.resolution_condition, e.created_at
			 FROM blockers b JOIN entities e ON e.id = b.entity_id
			 WHERE b.blocked_id = ? AND b.state = 'active'
			 ORDER BY e.created_at ASC`
		)
		.all(blockedId) as ActiveBlockerSummary[];
}

/** Batch active-blocker lookup keyed by blocked id (avoids N+1 in lists). */
export function activeBlockersForMany(
	db: Database.Database,
	blockedIds: string[]
): Map<string, ActiveBlockerSummary[]> {
	const map = new Map<string, ActiveBlockerSummary[]>();
	if (blockedIds.length === 0) return map;
	const placeholders = blockedIds.map(() => '?').join(',');
	const rows = db
		.prepare(
			`SELECT b.blocked_id, b.entity_id AS id, b.reason, b.source_kind, b.source_label,
			        b.source_work_id, b.resolution_condition, e.created_at
			 FROM blockers b JOIN entities e ON e.id = b.entity_id
			 WHERE b.blocked_id IN (${placeholders}) AND b.state = 'active'
			 ORDER BY e.created_at ASC`
		)
		.all(...blockedIds) as Array<ActiveBlockerSummary & { blocked_id: string }>;
	for (const row of rows) {
		const { blocked_id, ...summary } = row;
		const existing = map.get(blocked_id);
		if (existing) existing.push(summary);
		else map.set(blocked_id, [summary]);
	}
	return map;
}

export function isBlocked(db: Database.Database, blockedId: string): boolean {
	const row = db
		.prepare(`SELECT 1 FROM blockers WHERE blocked_id = ? AND state = 'active' LIMIT 1`)
		.get(blockedId);
	return row !== undefined;
}

/**
 * Task actionability for AXI projections: what the agent can act on now.
 * Blocked takes precedence over waiting (doc 02 display precedence).
 */
export function taskActionability(
	status: string,
	blocked: boolean
): 'actionable' | 'blocked' | 'waiting' | 'in_review' | 'terminal' | 'backlog' {
	if (status === 'completed' || status === 'cancelled') return 'terminal';
	if (blocked) return 'blocked';
	if (status === 'waiting') return 'waiting';
	if (status === 'in_review') return 'in_review';
	if (status === 'backlog') return 'backlog';
	return 'actionable';
}

/** Active (nonterminal) Work counts per Area, derived on read. */
export function activeWorkCountForArea(db: Database.Database, areaId: string): number {
	const row = db
		.prepare(
			`SELECT COUNT(*) AS count FROM entities e
			 JOIN tasks t ON t.entity_id = e.id
			 WHERE e.area_id = ? AND t.status NOT IN ('completed','cancelled')`
		)
		.get(areaId) as { count: number };
	return row.count;
}
