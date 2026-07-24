import type Database from 'better-sqlite3';

export type ProjectWorkType = 'task' | 'question' | 'decision' | 'change_request';

const terminalStates: Record<ProjectWorkType, readonly string[]> = {
	task: ['completed', 'cancelled'],
	question: ['answered', 'withdrawn'],
	decision: ['decided', 'withdrawn'],
	change_request: ['cancelled', 'rolled_back']
};

export function isTerminalProjectWork(
	type: ProjectWorkType,
	status: string,
	secondaryState: string | null = null,
	rollbackStartedAt: number | null = null
): boolean {
	if (type === 'change_request' && rollbackStartedAt !== null && status !== 'rolled_back') {
		return false;
	}
	if (type === 'change_request' && status === 'succeeded') {
		return secondaryState === 'passed' || secondaryState === 'waived';
	}
	return terminalStates[type].includes(status);
}

export function phaseWorkProgress(
	db: Database.Database,
	phaseId: string
): { total: number; terminal: number; open: number } {
	const rows = db
		.prepare(
			`SELECT type, status, secondary_state, rollback_started_at FROM (
			   SELECT 'task' AS type, status, NULL AS secondary_state, NULL AS rollback_started_at
			     FROM tasks WHERE phase_id = ?
			   UNION ALL
			   SELECT 'question', status, NULL, NULL FROM questions WHERE phase_id = ?
			   UNION ALL
			   SELECT 'decision', status, NULL, NULL FROM decisions WHERE phase_id = ?
			   UNION ALL
			   SELECT 'change_request', execution_state, verification_state, rollback_started_at
			     FROM change_requests WHERE phase_id = ?
			 )`
		)
		.all(phaseId, phaseId, phaseId, phaseId) as Array<{
		type: ProjectWorkType;
		status: string;
		secondary_state: string | null;
		rollback_started_at: number | null;
	}>;
	const terminal = rows.filter((row) =>
		isTerminalProjectWork(row.type, row.status, row.secondary_state, row.rollback_started_at)
	).length;
	return { total: rows.length, terminal, open: rows.length - terminal };
}

export function projectWorkProgress(
	db: Database.Database,
	projectId: string
): { total: number; terminal: number; open: number } {
	const rows = db
		.prepare(
			`SELECT type, status, secondary_state, rollback_started_at FROM (
			   SELECT 'task' AS type, status, NULL AS secondary_state, NULL AS rollback_started_at
			     FROM tasks WHERE project_id = ?
			   UNION ALL
			   SELECT 'question', status, NULL, NULL FROM questions WHERE project_id = ?
			   UNION ALL
			   SELECT 'decision', status, NULL, NULL FROM decisions WHERE project_id = ?
			   UNION ALL
			   SELECT 'change_request', execution_state, verification_state, rollback_started_at
			     FROM change_requests WHERE project_id = ?
			 )`
		)
		.all(projectId, projectId, projectId, projectId) as Array<{
		type: ProjectWorkType;
		status: string;
		secondary_state: string | null;
		rollback_started_at: number | null;
	}>;
	const terminal = rows.filter((row) =>
		isTerminalProjectWork(row.type, row.status, row.secondary_state, row.rollback_started_at)
	).length;
	return { total: rows.length, terminal, open: rows.length - terminal };
}

export function blockedProjectWorkCount(db: Database.Database, projectId: string): number {
	const rows = db
		.prepare(
			`SELECT DISTINCT b.blocked_id, e.type,
			        COALESCE(t.status, q.status, d.status, c.execution_state) AS status,
			        c.verification_state AS secondary_state,
			        c.rollback_started_at
				   FROM blockers b
				   JOIN entities e ON e.id = b.blocked_id
				   LEFT JOIN tasks t ON e.type = 'task' AND t.entity_id = e.id
				   LEFT JOIN questions q ON e.type = 'question' AND q.entity_id = e.id
				   LEFT JOIN decisions d ON e.type = 'decision' AND d.entity_id = e.id
				   LEFT JOIN change_requests c ON e.type = 'change_request' AND c.entity_id = e.id
				  WHERE b.state = 'active'
				    AND COALESCE(t.project_id, q.project_id, d.project_id, c.project_id) = ?`
		)
		.all(projectId) as Array<{
		type: ProjectWorkType;
		status: string;
		secondary_state: string | null;
		rollback_started_at: number | null;
	}>;
	return rows.filter(
		(row) =>
			!isTerminalProjectWork(row.type, row.status, row.secondary_state, row.rollback_started_at)
	).length;
}
