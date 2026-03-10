import { getDb } from './database.js';
import type { Category, Subcategory, Project, Plan, PlanVersion, Activity } from './database.js';

// ============================================================================
// CATEGORIES
// ============================================================================

export function listCategories(): Category[] {
	const db = getDb();
	return db
		.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')
		.all() as Category[];
}

export function getCategory(id: string): Category | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
}

export function createCategory(data: {
	id: string;
	name: string;
	description?: string;
	color?: string;
}): Category {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM categories').get() as {
		max: number | null;
	};
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare(
		'INSERT INTO categories (id, name, description, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(data.id, data.name, data.description ?? null, data.color ?? null, sortOrder, now);

	return getCategory(data.id)!;
}

export function updateCategory(
	id: string,
	data: { name?: string; description?: string; color?: string }
): Category | undefined {
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
	if (data.color !== undefined) {
		updates.push('color = ?');
		values.push(data.color);
	}

	if (updates.length === 0) return getCategory(id);

	values.push(id);
	db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	return getCategory(id);
}

export function deleteCategory(id: string): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
	return result.changes > 0;
}

export function reorderCategories(ids: string[]): void {
	const db = getDb();
	const transaction = db.transaction(() => {
		const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
		ids.forEach((id, index) => {
			stmt.run(index, id);
		});
	});
	transaction();
}

// ============================================================================
// SUBCATEGORIES
// ============================================================================

export function listSubcategories(categoryId?: string): Subcategory[] {
	const db = getDb();
	if (categoryId) {
		return db
			.prepare(
				'SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order ASC, name ASC'
			)
			.all(categoryId) as Subcategory[];
	}
	return db
		.prepare('SELECT * FROM subcategories ORDER BY sort_order ASC, name ASC')
		.all() as Subcategory[];
}

export function getSubcategory(id: string): Subcategory | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM subcategories WHERE id = ?').get(id) as Subcategory | undefined;
}

export function createSubcategory(data: {
	id: string;
	category_id: string;
	name: string;
	description?: string;
}): Subcategory {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM subcategories WHERE category_id = ?')
		.get(data.category_id) as { max: number | null };
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare(
		'INSERT INTO subcategories (id, category_id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(data.id, data.category_id, data.name, data.description ?? null, sortOrder, now);

	return getSubcategory(data.id)!;
}

export function updateSubcategory(
	id: string,
	data: { name?: string; description?: string; category_id?: string }
): Subcategory | undefined {
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
	if (data.category_id !== undefined) {
		updates.push('category_id = ?');
		values.push(data.category_id);
	}

	if (updates.length === 0) return getSubcategory(id);

	values.push(id);
	db.prepare(`UPDATE subcategories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	return getSubcategory(id);
}

export function deleteSubcategory(id: string): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM subcategories WHERE id = ?').run(id);
	return result.changes > 0;
}

export function reorderSubcategories(ids: string[]): void {
	const db = getDb();
	const transaction = db.transaction(() => {
		const stmt = db.prepare('UPDATE subcategories SET sort_order = ? WHERE id = ?');
		ids.forEach((id, index) => {
			stmt.run(index, id);
		});
	});
	transaction();
}

export function moveSubcategory(id: string, newCategoryId: string): Subcategory | undefined {
	const db = getDb();
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM subcategories WHERE category_id = ?')
		.get(newCategoryId) as { max: number | null };
	const sortOrder = (maxOrder.max ?? -1) + 1;

	db.prepare('UPDATE subcategories SET category_id = ?, sort_order = ? WHERE id = ?').run(
		newCategoryId,
		sortOrder,
		id
	);

	return getSubcategory(id);
}

// ============================================================================
// PROJECTS
// ============================================================================

export function listProjects(filters?: {
	category_id?: string;
	subcategory_id?: string;
	status?: string;
}): Project[] {
	const db = getDb();

	if (!filters || Object.keys(filters).length === 0) {
		return db.prepare('SELECT * FROM projects ORDER BY last_activity_at DESC').all() as Project[];
	}

	const conditions: string[] = [];
	const values: unknown[] = [];

	if (filters.category_id !== undefined) {
		conditions.push('category_id = ?');
		values.push(filters.category_id);
	}
	if (filters.subcategory_id !== undefined) {
		conditions.push('subcategory_id = ?');
		values.push(filters.subcategory_id);
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
	category_id: string;
	subcategory_id?: string;
	title: string;
	description?: string;
	body?: string;
	status?: string;
	due_date?: string;
	priority?: string;
	external_ref?: string;
}): Project {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	const result = db
		.prepare(
			`
		INSERT INTO projects (category_id, subcategory_id, title, description, body, status, due_date, priority, external_ref, created_at, updated_at, last_activity_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			data.category_id,
			data.subcategory_id ?? null,
			data.title,
			data.description ?? null,
			data.body ?? null,
			data.status ?? 'todo',
			data.due_date ?? null,
			data.priority ?? null,
			data.external_ref ?? null,
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
			| 'title'
			| 'description'
			| 'body'
			| 'status'
			| 'due_date'
			| 'priority'
			| 'category_id'
			| 'subcategory_id'
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
	if (data.category_id !== undefined) {
		updates.push('category_id = ?');
		values.push(data.category_id);
	}
	if (data.subcategory_id !== undefined) {
		updates.push('subcategory_id = ?');
		values.push(data.subcategory_id);
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

// ============================================================================
// PLANS
// ============================================================================

export function listPlans(
	filters: { project_id?: number; status?: string } | number
): (Plan & { project_title?: string })[] {
	const db = getDb();

	// Backwards-compat: accept plain projectId number
	if (typeof filters === 'number') {
		return db
			.prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
			.all(filters) as Plan[];
	}

	const { project_id, status } = filters;

	if (project_id !== undefined && status === undefined) {
		return db
			.prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
			.all(project_id) as Plan[];
	}

	const conditions: string[] = [];
	const values: unknown[] = [];

	if (project_id !== undefined) {
		conditions.push('pl.project_id = ?');
		values.push(project_id);
	}
	if (status !== undefined) {
		conditions.push('pl.status = ?');
		values.push(status);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const query = `
		SELECT pl.*, p.title as project_title
		FROM plans pl
		JOIN projects p ON pl.project_id = p.id
		${where}
		ORDER BY pl.sort_order ASC, pl.created_at ASC
	`;
	return db.prepare(query).all(...values) as (Plan & { project_title: string })[];
}

export function getPlan(id: number): Plan | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
}

export function createPlan(data: {
	project_id: number;
	title: string;
	description?: string;
	result?: string;
	status?: string;
}): Plan {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM plans WHERE project_id = ?')
		.get(data.project_id) as { max: number | null };
	const sortOrder = (maxOrder.max ?? -1) + 1;

	const result = db
		.prepare(
			`INSERT INTO plans (project_id, title, description, result, status, sort_order, version, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			data.project_id,
			data.title,
			data.description ?? null,
			data.result ?? null,
			data.status ?? 'planning',
			sortOrder,
			1, // Initial version
			'user',
			now,
			now
		);

	const planId = result.lastInsertRowid as number;
	const plan = getPlan(planId)!;

	// Create initial version
	createPlanVersion(planId, plan.description, plan.result, plan.status, 'system');

	// Log activity
	logActivity({
		project_id: data.project_id,
		actor: 'system',
		action: 'plan_created',
		target_type: 'plan',
		target_id: planId,
		target_title: data.title
	});

	return plan;
}

export function updatePlan(
	id: number,
	data: { title?: string; description?: string; result?: string; status?: string }
): Plan | undefined {
	const db = getDb();
	const currentPlan = getPlan(id);
	if (!currentPlan) return undefined;

	const now = Math.floor(Date.now() / 1000);
	const updates: string[] = ['updated_at = ?'];
	const values: unknown[] = [now];

	// Track what changed for versioning
	let descriptionChanged = false;
	let resultChanged = false;
	let statusChanged = false;
	let needsVersionIncrement = false;

	if (data.title !== undefined) {
		updates.push('title = ?');
		values.push(data.title);
	}
	if (data.description !== undefined && data.description !== currentPlan.description) {
		updates.push('description = ?');
		values.push(data.description);
		descriptionChanged = true;
		needsVersionIncrement = true;
	}
	if (data.result !== undefined && data.result !== currentPlan.result) {
		updates.push('result = ?');
		values.push(data.result);
		resultChanged = true;
		needsVersionIncrement = true;
	}
	if (data.status !== undefined && data.status !== currentPlan.status) {
		updates.push('status = ?');
		values.push(data.status);
		statusChanged = true;
		needsVersionIncrement = true;
	}

	// Increment version if content changed
	if (needsVersionIncrement) {
		updates.push('version = version + 1');
	}

	if (updates.length === 1) return currentPlan;

	values.push(id);
	db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);

	const updatedPlan = getPlan(id)!;

	// Create version if content changed
	if (descriptionChanged || resultChanged || statusChanged) {
		createPlanVersion(id, updatedPlan.description, updatedPlan.result, updatedPlan.status, 'user');
	}

	// Log activity
	const action = statusChanged ? 'plan_status_changed' : 'plan_updated';
	logActivity({
		project_id: updatedPlan.project_id,
		actor: 'system',
		action,
		target_type: 'plan',
		target_id: id,
		target_title: updatedPlan.title,
		details: statusChanged ? `Status changed to ${updatedPlan.status}` : undefined
	});

	return updatedPlan;
}

export function deletePlan(id: number): boolean {
	const db = getDb();
	const result = db.prepare('DELETE FROM plans WHERE id = ?').run(id);
	return result.changes > 0;
}

export function reorderPlans(ids: number[]): void {
	const db = getDb();
	const transaction = db.transaction(() => {
		const stmt = db.prepare('UPDATE plans SET sort_order = ? WHERE id = ?');
		ids.forEach((id, index) => {
			stmt.run(index, id);
		});
	});
	transaction();
}

// ============================================================================
// PLAN VERSIONS
// ============================================================================

export function listPlanVersions(planId: number): PlanVersion[] {
	const db = getDb();
	return db
		.prepare('SELECT * FROM plan_versions WHERE plan_id = ? ORDER BY version DESC')
		.all(planId) as PlanVersion[];
}

export function createPlanVersion(
	planId: number,
	description: string | null,
	result: string | null,
	status: string,
	createdBy: string = 'system'
): PlanVersion {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);

	// Get next version number
	const lastVersion = db
		.prepare('SELECT MAX(version) as max FROM plan_versions WHERE plan_id = ?')
		.get(planId) as { max: number | null };
	const version = (lastVersion.max ?? 0) + 1;

	const result_insert = db
		.prepare(
			`INSERT INTO plan_versions (plan_id, version, description, result, status, created_by, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(planId, version, description, result, status, createdBy, now);

	const versionId = result_insert.lastInsertRowid as number;
	return db.prepare('SELECT * FROM plan_versions WHERE id = ?').get(versionId) as PlanVersion;
}

export function revertPlanVersion(planId: number, version: number): Plan | undefined {
	const db = getDb();

	// Get the version to revert to
	const versionData = db
		.prepare('SELECT * FROM plan_versions WHERE plan_id = ? AND version = ?')
		.get(planId, version) as PlanVersion | undefined;

	if (!versionData) return undefined;

	// Update the plan
	const now = Math.floor(Date.now() / 1000);
	db.prepare(
		`UPDATE plans SET description = ?, result = ?, status = ?, updated_at = ? WHERE id = ?`
	).run(versionData.description, versionData.result, versionData.status, now, planId);

	const updatedPlan = getPlan(planId)!;

	// Create new version for the revert
	createPlanVersion(
		planId,
		versionData.description,
		versionData.result,
		versionData.status,
		'user'
	);

	// Log activity
	logActivity({
		project_id: updatedPlan.project_id,
		actor: 'system',
		action: 'plan_updated',
		target_type: 'plan',
		target_id: planId,
		target_title: updatedPlan.title,
		details: `Reverted to version ${version}`
	});

	return updatedPlan;
}
