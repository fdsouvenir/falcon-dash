import { getDb } from './database.js';
import { PMError, PM_ERRORS, parseId } from './validation.js';

export interface BulkResult {
	updated: number;
	errors: { id: number | string; error: string }[];
}

// Bulk update fields on multiple projects or tasks
export function bulkUpdate(params: {
	entityType: 'project' | 'task';
	ids: (number | string)[];
	fields: {
		status?: string;
		priority?: string;
		milestone_id?: number | null;
		due_date?: string | null;
	};
}): BulkResult {
	const db = getDb();
	const result: BulkResult = { updated: 0, errors: [] };
	const table = params.entityType === 'project' ? 'projects' : 'tasks';

	const setClauses: string[] = [];
	const values: unknown[] = [];

	if (params.fields.status !== undefined) {
		setClauses.push('status = ?');
		values.push(params.fields.status);
	}
	if (params.fields.priority !== undefined) {
		setClauses.push('priority = ?');
		values.push(params.fields.priority);
	}
	if (params.fields.milestone_id !== undefined) {
		setClauses.push('milestone_id = ?');
		values.push(params.fields.milestone_id);
	}
	if (params.fields.due_date !== undefined) {
		setClauses.push('due_date = ?');
		values.push(params.fields.due_date);
	}

	if (setClauses.length === 0) return result;

	setClauses.push('updated_at = unixepoch()');
	setClauses.push('last_activity_at = unixepoch()');

	const stmt = db.prepare(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`);

	const transaction = db.transaction(() => {
		for (const rawId of params.ids) {
			try {
				const id = typeof rawId === 'string' ? parseId(rawId) : rawId;
				const info = stmt.run(...values, id);
				if (info.changes > 0) {
					result.updated++;
				} else {
					result.errors.push({ id: rawId, error: 'Not found' });
				}
			} catch (err) {
				result.errors.push({ id: rawId, error: (err as Error).message });
			}
		}
	});

	transaction();
	return result;
}

// Bulk move tasks to a new parent
export function bulkMove(params: {
	ids: (number | string)[];
	target: {
		parent_project_id?: number;
		parent_task_id?: number;
	};
}): BulkResult {
	const db = getDb();
	const result: BulkResult = { updated: 0, errors: [] };

	if (!params.target.parent_project_id && !params.target.parent_task_id) {
		throw new PMError(PM_ERRORS.PM_CONSTRAINT, 'Must specify parent_project_id or parent_task_id');
	}

	// Check target exists
	if (params.target.parent_project_id) {
		const project = db
			.prepare('SELECT id FROM projects WHERE id = ?')
			.get(params.target.parent_project_id);
		if (!project) throw new PMError(PM_ERRORS.PM_NOT_FOUND, 'Target project not found');
	}
	if (params.target.parent_task_id) {
		const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(params.target.parent_task_id);
		if (!task) throw new PMError(PM_ERRORS.PM_NOT_FOUND, 'Target task not found');
	}

	const transaction = db.transaction(() => {
		for (const rawId of params.ids) {
			try {
				const id = typeof rawId === 'string' ? parseId(rawId) : rawId;

				// Check for circular dependency if moving to a task parent
				if (params.target.parent_task_id) {
					// Ensure target is not a descendant of the task being moved
					let current: number | null = params.target.parent_task_id;
					while (current !== null) {
						if (current === id) {
							throw new PMError(
								PM_ERRORS.PM_CIRCULAR_BLOCK,
								`Moving task ${id} under ${params.target.parent_task_id} would create a cycle`
							);
						}
						const parent = db
							.prepare('SELECT parent_task_id FROM tasks WHERE id = ?')
							.get(current) as { parent_task_id: number | null } | undefined;
						current = parent?.parent_task_id ?? null;
					}
				}

				const setClauses = [];
				const vals: unknown[] = [];

				if (params.target.parent_project_id) {
					setClauses.push('parent_project_id = ?', 'parent_task_id = NULL');
					vals.push(params.target.parent_project_id);
				} else {
					setClauses.push('parent_project_id = NULL', 'parent_task_id = ?');
					vals.push(params.target.parent_task_id);
				}

				setClauses.push('updated_at = unixepoch()');

				const info = db
					.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`)
					.run(...vals, id);
				if (info.changes > 0) {
					result.updated++;
				} else {
					result.errors.push({ id: rawId, error: 'Not found' });
				}
			} catch (err) {
				result.errors.push({ id: rawId, error: (err as Error).message });
			}
		}
	});

	transaction();
	return result;
}
