import { getDb } from './database.js';
import type {
	Domain,
	Focus,
	Milestone,
	Project,
	Task,
	Comment,
	Block,
	Activity,
	Attachment
} from './database.js';

// Helper function to resolve project_id from a task_id
function resolveProjectId(taskId: number): number | null {
	const db = getDb();
	const stmt = db.prepare('SELECT parent_project_id, parent_task_id FROM tasks WHERE id = ?');
	let currentId = taskId;

	while (currentId) {
		const task = stmt.get(currentId) as
			| { parent_project_id: number | null; parent_task_id: number | null }
			| undefined;
		if (!task) return null;
		if (task.parent_project_id) return task.parent_project_id;
		if (task.parent_task_id) {
			currentId = task.parent_task_id;
		} else {
			return null;
		}
	}

	return null;
}

// ============================================================================
// DOMAINS
// ============================================================================

export function listDomains(): Domain[] {
	const db = getDb();
	return db.prepare('SELECT * FROM domains ORDER BY sort_order ASC, name ASC').all() as Domain[];
}

export function getDomain(id: string): Domain | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as Domain | undefined;
}

export function createDomain(data: { id: string; name: string; description?: string }): Domain {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM domains').get() as {
		max: number | null;
	};
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare(
		'INSERT INTO domains (id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
	).run(data.id, data.name, data.description ?? null, sortOrder, now);

	return getDomain(data.id)!;
}

export function updateDomain(
	id: string,
	data: { name?: string; description?: string }
): Domain | undefined {
	const db = getDb();
	const updates: string[] = [];
	const values: unknown[] = [];

	if (data.name !== undefined) {
		updates.push('name = ?');
		values.push(data.name);
	}
	if (data.description !== undefined) {
		updates.push('description = ?');
		values.push(data.description);
	}

	if (updates.length === 0) return getDomain(id);

	values.push(id);
	db.prepare(`UPDATE domains SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	return getDomain(id);
}

export function deleteDomain(id: string): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM domains WHERE id = ?').run(id);
	return result.changes > 0;
}

export function reorderDomains(ids: string[]): void {
	const db = getDb();
	const transaction = db.transaction(() => {
		const stmt = db.prepare('UPDATE domains SET sort_order = ? WHERE id = ?');
		ids.forEach((id, index) => {
			stmt.run(index, id);
		});
	});
	transaction();
}

// ============================================================================
// FOCUSES
// ============================================================================

export function listFocuses(domainId?: string): Focus[] {
	const db = getDb();
	if (domainId) {
		return db
			.prepare('SELECT * FROM focuses WHERE domain_id = ? ORDER BY sort_order ASC, name ASC')
			.all(domainId) as Focus[];
	}
	return db.prepare('SELECT * FROM focuses ORDER BY sort_order ASC, name ASC').all() as Focus[];
}

export function getFocus(id: string): Focus | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM focuses WHERE id = ?').get(id) as Focus | undefined;
}

export function createFocus(data: {
	id: string;
	domain_id: string;
	name: string;
	description?: string;
}): Focus {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM focuses WHERE domain_id = ?')
		.get(data.domain_id) as { max: number | null };
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare(
		'INSERT INTO focuses (id, domain_id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(data.id, data.domain_id, data.name, data.description ?? null, sortOrder, now);

	return getFocus(data.id)!;
}

export function updateFocus(
	id: string,
	data: { name?: string; description?: string; domain_id?: string }
): Focus | undefined {
	const db = getDb();
	const updates: string[] = [];
	const values: unknown[] = [];

	if (data.name !== undefined) {
		updates.push('name = ?');
		values.push(data.name);
	}
	if (data.description !== undefined) {
		updates.push('description = ?');
		values.push(data.description);
	}
	if (data.domain_id !== undefined) {
		updates.push('domain_id = ?');
		values.push(data.domain_id);
	}

	if (updates.length === 0) return getFocus(id);

	values.push(id);
	db.prepare(`UPDATE focuses SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	return getFocus(id);
}

export function deleteFocus(id: string): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM focuses WHERE id = ?').run(id);
	return result.changes > 0;
}

export function reorderFocuses(ids: string[]): void {
	const db = getDb();
	const transaction = db.transaction(() => {
		const stmt = db.prepare('UPDATE focuses SET sort_order = ? WHERE id = ?');
		ids.forEach((id, index) => {
			stmt.run(index, id);
		});
	});
	transaction();
}

export function moveFocus(id: string, newDomainId: string): Focus | undefined {
	const db = getDb();
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM focuses WHERE domain_id = ?')
		.get(newDomainId) as { max: number | null };
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare('UPDATE focuses SET domain_id = ?, sort_order = ? WHERE id = ?').run(
		newDomainId,
		sortOrder,
		id
	);

	return getFocus(id);
}

// ============================================================================
// MILESTONES
// ============================================================================

export function listMilestones(): Milestone[] {
	const db = getDb();
	return db
		.prepare('SELECT * FROM milestones ORDER BY due_date ASC NULLS LAST, name ASC')
		.all() as Milestone[];
}

export function getMilestone(id: number): Milestone | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as Milestone | undefined;
}

export function createMilestone(data: {
	name: string;
	due_date?: string;
	description?: string;
}): Milestone {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare('INSERT INTO milestones (name, due_date, description, created_at) VALUES (?, ?, ?, ?)')
		.run(data.name, data.due_date ?? null, data.description ?? null, now);

	return getMilestone(result.lastInsertRowid as number)!;
}

export function updateMilestone(
	id: number,
	data: { name?: string; due_date?: string; description?: string }
): Milestone | undefined {
	const db = getDb();
	const updates: string[] = [];
	const values: unknown[] = [];

	if (data.name !== undefined) {
		updates.push('name = ?');
		values.push(data.name);
	}
	if (data.due_date !== undefined) {
		updates.push('due_date = ?');
		values.push(data.due_date);
	}
	if (data.description !== undefined) {
		updates.push('description = ?');
		values.push(data.description);
	}

	if (updates.length === 0) return getMilestone(id);

	values.push(id);
	db.prepare(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	return getMilestone(id);
}

export function deleteMilestone(id: number): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
	return result.changes > 0;
}

// ============================================================================
// PROJECTS
// ============================================================================

export function listProjects(filters?: {
	focus_id?: string;
	status?: string;
	milestone_id?: number;
}): Project[] {
	const db = getDb();

	if (!filters || Object.keys(filters).length === 0) {
		return db.prepare('SELECT * FROM projects ORDER BY last_activity_at DESC').all() as Project[];
	}

	const conditions: string[] = [];
	const values: unknown[] = [];

	if (filters.focus_id !== undefined) {
		conditions.push('focus_id = ?');
		values.push(filters.focus_id);
	}
	if (filters.status !== undefined) {
		conditions.push('status = ?');
		values.push(filters.status);
	}
	if (filters.milestone_id !== undefined) {
		conditions.push('milestone_id = ?');
		values.push(filters.milestone_id);
	}

	const query = `SELECT * FROM projects WHERE ${conditions.join(' AND ')} ORDER BY last_activity_at DESC`;
	return db.prepare(query).all(...values) as Project[];
}

export function getProject(id: number): Project | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function createProject(data: {
	focus_id: string;
	title: string;
	description?: string;
	status?: string;
	milestone_id?: number;
	due_date?: string;
	priority?: string;
}): Project {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare(
			`
		INSERT INTO projects (focus_id, title, description, status, milestone_id, due_date, priority, created_at, updated_at, last_activity_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			data.focus_id,
			data.title,
			data.description ?? null,
			data.status ?? 'todo',
			data.milestone_id ?? null,
			data.due_date ?? null,
			data.priority ?? null,
			now,
			now,
			now
		);

	const projectId = result.lastInsertRowid as number;
	const project = getProject(projectId)!;

	// Log activity
	logActivity({
		project_id: projectId,
		actor: 'system',
		action: 'created',
		target_type: 'project',
		target_id: projectId,
		target_title: data.title
	});

	return project;
}

export function updateProject(
	id: number,
	data: Partial<
		Pick<
			Project,
			'title' | 'description' | 'status' | 'milestone_id' | 'due_date' | 'priority' | 'focus_id'
		>
	>
): Project | undefined {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const updates: string[] = ['updated_at = ?', 'last_activity_at = ?'];
	const values: unknown[] = [now, now];

	if (data.title !== undefined) {
		updates.push('title = ?');
		values.push(data.title);
	}
	if (data.description !== undefined) {
		updates.push('description = ?');
		values.push(data.description);
	}
	if (data.status !== undefined) {
		updates.push('status = ?');
		values.push(data.status);
	}
	if (data.milestone_id !== undefined) {
		updates.push('milestone_id = ?');
		values.push(data.milestone_id);
	}
	if (data.due_date !== undefined) {
		updates.push('due_date = ?');
		values.push(data.due_date);
	}
	if (data.priority !== undefined) {
		updates.push('priority = ?');
		values.push(data.priority);
	}
	if (data.focus_id !== undefined) {
		updates.push('focus_id = ?');
		values.push(data.focus_id);
	}

	if (updates.length === 2) return getProject(id);

	values.push(id);
	db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	const project = getProject(id);
	if (project) {
		logActivity({
			project_id: id,
			actor: 'system',
			action: 'updated',
			target_type: 'project',
			target_id: id,
			target_title: project.title
		});
	}

	return project;
}

export function deleteProject(id: number): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
	return result.changes > 0;
}

// ============================================================================
// TASKS
// ============================================================================

export function listTasks(filters?: {
	parent_project_id?: number;
	parent_task_id?: number;
	status?: string;
}): Task[] {
	const db = getDb();

	if (!filters || Object.keys(filters).length === 0) {
		return db.prepare('SELECT * FROM tasks ORDER BY sort_order ASC').all() as Task[];
	}

	const conditions: string[] = [];
	const values: unknown[] = [];

	if (filters.parent_project_id !== undefined) {
		conditions.push('parent_project_id = ?');
		values.push(filters.parent_project_id);
	}
	if (filters.parent_task_id !== undefined) {
		conditions.push('parent_task_id = ?');
		values.push(filters.parent_task_id);
	}
	if (filters.status !== undefined) {
		conditions.push('status = ?');
		values.push(filters.status);
	}

	const query = `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC`;
	return db.prepare(query).all(...values) as Task[];
}

export function getTask(id: number): Task | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
}

export function createTask(data: {
	title: string;
	body?: string;
	parent_project_id?: number;
	parent_task_id?: number;
	status?: string;
	due_date?: string;
	priority?: string;
	milestone_id?: number;
}): Task {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	// Determine sort order
	let maxOrder: { max: number | null };
	if (data.parent_project_id) {
		maxOrder = db
			.prepare('SELECT MAX(sort_order) as max FROM tasks WHERE parent_project_id = ?')
			.get(data.parent_project_id) as { max: number | null };
	} else if (data.parent_task_id) {
		maxOrder = db
			.prepare('SELECT MAX(sort_order) as max FROM tasks WHERE parent_task_id = ?')
			.get(data.parent_task_id) as { max: number | null };
	} else {
		maxOrder = { max: null };
	}
	const sortOrder = (maxOrder.max ?? -1) + 1;

	const result = db
		.prepare(
			`
		INSERT INTO tasks (title, body, parent_project_id, parent_task_id, status, due_date, priority, milestone_id, sort_order, created_at, updated_at, last_activity_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			data.title,
			data.body ?? null,
			data.parent_project_id ?? null,
			data.parent_task_id ?? null,
			data.status ?? 'todo',
			data.due_date ?? null,
			data.priority ?? null,
			data.milestone_id ?? null,
			sortOrder,
			now,
			now,
			now
		);

	const taskId = result.lastInsertRowid as number;
	const task = getTask(taskId)!;

	// Resolve project and log activity
	const projectId = data.parent_project_id ?? resolveProjectId(taskId);
	if (projectId) {
		// Update project's last_activity_at
		db.prepare('UPDATE projects SET last_activity_at = ? WHERE id = ?').run(now, projectId);

		logActivity({
			project_id: projectId,
			actor: 'system',
			action: 'created',
			target_type: 'task',
			target_id: taskId,
			target_title: data.title
		});
	}

	return task;
}

export function updateTask(
	id: number,
	data: Partial<Pick<Task, 'title' | 'body' | 'status' | 'due_date' | 'priority' | 'milestone_id'>>
): Task | undefined {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const task = getTask(id);
	if (!task) return undefined;

	const updates: string[] = ['updated_at = ?', 'last_activity_at = ?'];
	const values: unknown[] = [now, now];

	if (data.title !== undefined) {
		updates.push('title = ?');
		values.push(data.title);
	}
	if (data.body !== undefined) {
		updates.push('body = ?');
		values.push(data.body);
	}
	if (data.status !== undefined) {
		updates.push('status = ?');
		values.push(data.status);
	}
	if (data.due_date !== undefined) {
		updates.push('due_date = ?');
		values.push(data.due_date);
	}
	if (data.priority !== undefined) {
		updates.push('priority = ?');
		values.push(data.priority);
	}
	if (data.milestone_id !== undefined) {
		updates.push('milestone_id = ?');
		values.push(data.milestone_id);
	}

	if (updates.length === 2) return getTask(id);

	values.push(id);
	db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	const updatedTask = getTask(id)!;

	// Resolve project and log activity
	const projectId = task.parent_project_id ?? resolveProjectId(id);
	if (projectId) {
		// Update project's last_activity_at
		db.prepare('UPDATE projects SET last_activity_at = ? WHERE id = ?').run(now, projectId);

		const action =
			data.status !== undefined && data.status !== task.status ? 'status_changed' : 'updated';
		logActivity({
			project_id: projectId,
			actor: 'system',
			action,
			target_type: 'task',
			target_id: id,
			target_title: updatedTask.title,
			details:
				data.status !== undefined && data.status !== task.status
					? `${task.status} → ${data.status}`
					: undefined
		});
	}

	return updatedTask;
}

export function moveTask(
	id: number,
	target: { parent_project_id?: number; parent_task_id?: number }
): Task | undefined {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	// Determine new sort order
	let maxOrder: { max: number | null };
	if (target.parent_project_id) {
		maxOrder = db
			.prepare('SELECT MAX(sort_order) as max FROM tasks WHERE parent_project_id = ?')
			.get(target.parent_project_id) as { max: number | null };
	} else if (target.parent_task_id) {
		maxOrder = db
			.prepare('SELECT MAX(sort_order) as max FROM tasks WHERE parent_task_id = ?')
			.get(target.parent_task_id) as { max: number | null };
	} else {
		return undefined;
	}
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare(
		`
		UPDATE tasks
		SET parent_project_id = ?, parent_task_id = ?, sort_order = ?, updated_at = ?, last_activity_at = ?
		WHERE id = ?
	`
	).run(target.parent_project_id ?? null, target.parent_task_id ?? null, sortOrder, now, now, id);

	return getTask(id);
}

export function reorderTasks(ids: number[]): void {
	const db = getDb();
	const transaction = db.transaction(() => {
		const stmt = db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?');
		ids.forEach((id, index) => {
			stmt.run(index, id);
		});
	});
	transaction();
}

export function deleteTask(id: number): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
	return result.changes > 0;
}

// ============================================================================
// COMMENTS
// ============================================================================

export function listComments(targetType: string, targetId: number): Comment[] {
	const db = getDb();
	return db
		.prepare(
			'SELECT * FROM comments WHERE target_type = ? AND target_id = ? ORDER BY created_at ASC'
		)
		.all(targetType, targetId) as Comment[];
}

export function getComment(id: number): Comment | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment | undefined;
}

export function createComment(data: {
	target_type: string;
	target_id: number;
	body: string;
	author: string;
}): Comment {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare(
			'INSERT INTO comments (target_type, target_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)'
		)
		.run(data.target_type, data.target_id, data.body, data.author, now);

	const commentId = result.lastInsertRowid as number;
	const comment = getComment(commentId)!;

	// Update parent's last_activity_at and log activity
	if (data.target_type === 'project') {
		db.prepare('UPDATE projects SET last_activity_at = ? WHERE id = ?').run(now, data.target_id);
		logActivity({
			project_id: data.target_id,
			actor: data.author,
			action: 'commented',
			target_type: 'comment',
			target_id: commentId
		});
	} else if (data.target_type === 'task') {
		db.prepare('UPDATE tasks SET last_activity_at = ? WHERE id = ?').run(now, data.target_id);
		const projectId = resolveProjectId(data.target_id);
		if (projectId) {
			db.prepare('UPDATE projects SET last_activity_at = ? WHERE id = ?').run(now, projectId);
			logActivity({
				project_id: projectId,
				actor: data.author,
				action: 'commented',
				target_type: 'comment',
				target_id: commentId
			});
		}
	}

	return comment;
}

export function deleteComment(id: number): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
	return result.changes > 0;
}

// ============================================================================
// BLOCKS
// ============================================================================

export function listBlocks(taskId: number): { blocking: Block[]; blockedBy: Block[] } {
	const db = getDb();
	const blocking = db.prepare('SELECT * FROM blocks WHERE blocker_id = ?').all(taskId) as Block[];
	const blockedBy = db.prepare('SELECT * FROM blocks WHERE blocked_id = ?').all(taskId) as Block[];
	return { blocking, blockedBy };
}

export function createBlock(blockerId: number, blockedId: number): Block {
	const db = getDb();
	db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
	return { blocker_id: blockerId, blocked_id: blockedId };
}

export function deleteBlock(blockerId: number, blockedId: number): boolean {
	const db = getDb();
	const result = db
		.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?')
		.run(blockerId, blockedId);
	return result.changes > 0;
}

// ============================================================================
// ACTIVITIES
// ============================================================================

export function listActivities(projectId: number, limit?: number): Activity[] {
	const db = getDb();
	const query = limit
		? 'SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
		: 'SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC';

	return limit
		? (db.prepare(query).all(projectId, limit) as Activity[])
		: (db.prepare(query).all(projectId) as Activity[]);
}

export function logActivity(data: {
	project_id: number;
	actor: string;
	action: string;
	target_type: string;
	target_id: number;
	target_title?: string;
	details?: string;
}): Activity {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare(
			`
		INSERT INTO activities (project_id, actor, action, target_type, target_id, target_title, details, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			data.project_id,
			data.actor,
			data.action,
			data.target_type,
			data.target_id,
			data.target_title ?? null,
			data.details ?? null,
			now
		);

	const activityId = result.lastInsertRowid as number;
	return db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId) as Activity;
}

// ============================================================================
// ATTACHMENTS
// ============================================================================

export function listAttachments(targetType: string, targetId: number): Attachment[] {
	const db = getDb();
	return db
		.prepare(
			'SELECT * FROM attachments WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC'
		)
		.all(targetType, targetId) as Attachment[];
}

export function createAttachment(data: {
	target_type: string;
	target_id: number;
	file_path: string;
	file_name: string;
	description?: string;
	added_by: string;
}): Attachment {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare(
			`
		INSERT INTO attachments (target_type, target_id, file_path, file_name, description, added_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			data.target_type,
			data.target_id,
			data.file_path,
			data.file_name,
			data.description ?? null,
			data.added_by,
			now
		);

	const attachmentId = result.lastInsertRowid as number;
	return db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId) as Attachment;
}

export function deleteAttachment(id: number): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
	return result.changes > 0;
}
