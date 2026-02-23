import { getDb } from './database.js';
import type { Domain, Focus, Project, Activity } from './database.js';

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
// PROJECTS
// ============================================================================

export function listProjects(filters?: { focus_id?: string; status?: string }): Project[] {
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
	body?: string;
	status?: string;
	due_date?: string;
	priority?: string;
}): Project {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare(
			`
		INSERT INTO projects (focus_id, title, description, body, status, due_date, priority, created_at, updated_at, last_activity_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			data.focus_id,
			data.title,
			data.description ?? null,
			data.body ?? null,
			data.status ?? 'todo',
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
			'title' | 'description' | 'body' | 'status' | 'due_date' | 'priority' | 'focus_id'
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
