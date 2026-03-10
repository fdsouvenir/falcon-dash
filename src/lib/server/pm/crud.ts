import { getDb } from './database.js';
import type { Category, Subcategory, Project, Plan, PlanVersion, Activity } from './database.js';
import { PMError, PM_ERRORS } from './validation.js';

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

export type EnrichedPlan = Plan & {
	project_title?: string;
	depends_on: number[];
	depth: number;
	blocked_by: Array<{ id: number; title: string; status: string }>;
};

function enrichPlansWithDependencies(rawPlans: (Plan & { project_title?: string })[]): EnrichedPlan[] {
	if (rawPlans.length === 0) return [];

	const db = getDb();
	const planIds = rawPlans.map((p) => p.id);
	const planIdSet = new Set(planIds);

	// Fetch all dependencies for these plans
	const placeholders = planIds.map(() => '?').join(',');
	const deps = db
		.prepare(`SELECT plan_id, depends_on_plan_id FROM plan_dependencies WHERE plan_id IN (${placeholders})`)
		.all(...planIds) as Array<{ plan_id: number; depends_on_plan_id: number }>;

	// Build dependency map
	const depsMap = new Map<number, number[]>();
	for (const d of deps) {
		if (!depsMap.has(d.plan_id)) depsMap.set(d.plan_id, []);
		depsMap.get(d.plan_id)!.push(d.depends_on_plan_id);
	}

	// Topological sort (Kahn's algorithm) — only within returned plans
	const inDegree = new Map<number, number>();
	const adj = new Map<number, number[]>(); // depends_on_plan_id -> [plan_id, ...]

	for (const id of planIds) {
		inDegree.set(id, 0);
	}

	for (const d of deps) {
		if (planIdSet.has(d.depends_on_plan_id)) {
			inDegree.set(d.plan_id, (inDegree.get(d.plan_id) ?? 0) + 1);
			if (!adj.has(d.depends_on_plan_id)) adj.set(d.depends_on_plan_id, []);
			adj.get(d.depends_on_plan_id)!.push(d.plan_id);
		}
	}

	const depthMap = new Map<number, number>();
	const queue: Array<{ id: number; depth: number }> = [];

	for (const id of planIds) {
		if ((inDegree.get(id) ?? 0) === 0) {
			queue.push({ id, depth: 0 });
			depthMap.set(id, 0);
		}
	}

	let idx = 0;
	while (idx < queue.length) {
		const { id, depth } = queue[idx++];
		const dependents = adj.get(id) || [];
		for (const dep of dependents) {
			inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1);
			const newDepth = depth + 1;
			if (!depthMap.has(dep) || newDepth > depthMap.get(dep)!) {
				depthMap.set(dep, newDepth);
			}
			if (inDegree.get(dep) === 0) {
				queue.push({ id: dep, depth: depthMap.get(dep)! });
			}
		}
	}

	// Plans not reached (cycles) get max depth
	for (const id of planIds) {
		if (!depthMap.has(id)) depthMap.set(id, 999);
	}

	// Fetch blocked_by info (incomplete deps) for all plans in one query
	const blockedByMap = new Map<number, Array<{ id: number; title: string; status: string }>>();
	if (deps.length > 0) {
		const allDepIds = [...new Set(deps.map((d) => d.depends_on_plan_id))];
		const depPlaceholders = allDepIds.map(() => '?').join(',');
		const depPlans = db
			.prepare(`SELECT id, title, status FROM plans WHERE id IN (${depPlaceholders}) AND status NOT IN ('complete', 'cancelled')`)
			.all(...allDepIds) as Array<{ id: number; title: string; status: string }>;
		const depPlanMap = new Map(depPlans.map((p) => [p.id, p]));

		for (const d of deps) {
			const depPlan = depPlanMap.get(d.depends_on_plan_id);
			if (depPlan) {
				if (!blockedByMap.has(d.plan_id)) blockedByMap.set(d.plan_id, []);
				blockedByMap.get(d.plan_id)!.push(depPlan);
			}
		}
	}

	// Build enriched plans
	const enriched: EnrichedPlan[] = rawPlans.map((p) => ({
		...p,
		depends_on: depsMap.get(p.id) || [],
		depth: depthMap.get(p.id) ?? 0,
		blocked_by: blockedByMap.get(p.id) || []
	}));

	// Sort by depth ASC, then sort_order ASC, then created_at ASC
	enriched.sort((a, b) => {
		if (a.depth !== b.depth) return a.depth - b.depth;
		if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
		return a.created_at - b.created_at;
	});

	return enriched;
}

export function listPlans(
	filters: { project_id?: number; status?: string } | number
): EnrichedPlan[] {
	const db = getDb();

	let rawPlans: (Plan & { project_title?: string })[];

	// Backwards-compat: accept plain projectId number
	if (typeof filters === 'number') {
		rawPlans = db
			.prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
			.all(filters) as Plan[];
	} else {
		const { project_id, status } = filters;

		if (project_id !== undefined && status === undefined) {
			rawPlans = db
				.prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC')
				.all(project_id) as Plan[];
		} else {
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
			rawPlans = db.prepare(query).all(...values) as (Plan & { project_title: string })[];
		}
	}

	return enrichPlansWithDependencies(rawPlans);
}

export function getPlan(id: number): (Plan & { depends_on: number[]; blocked_by: Array<{ id: number; title: string; status: string }> }) | undefined {
	const db = getDb();
	const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
	if (!plan) return undefined;
	return {
		...plan,
		depends_on: getDependencies(id),
		blocked_by: getDependenciesEnriched(id)
	};
}

// Internal getter without enrichment (used during updates to avoid recursion)
function getPlanRaw(id: number): Plan | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
}

export function createPlan(data: {
	project_id: number;
	title: string;
	description?: string;
	result?: string;
	status?: string;
	depends_on?: number[];
}): Plan & { depends_on: number[]; blocked_by: Array<{ id: number; title: string; status: string }> } {
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
	const plan = getPlanRaw(planId)!;

	// Set dependencies if provided
	if (data.depends_on && data.depends_on.length > 0) {
		setDependencies(planId, data.depends_on);
	}

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

	return {
		...plan,
		depends_on: getDependencies(planId),
		blocked_by: getDependenciesEnriched(planId)
	};
}

export function updatePlan(
	id: number,
	data: { title?: string; description?: string; result?: string; status?: string; depends_on?: number[] }
): (Plan & { depends_on: number[]; blocked_by: Array<{ id: number; title: string; status: string }> }) | undefined {
	const db = getDb();
	const currentPlan = getPlanRaw(id);
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

	if (updates.length === 1 && !data.depends_on) return { ...currentPlan, depends_on: getDependencies(id), blocked_by: getDependenciesEnriched(id) };

	// Status constraint: can't assign/start plans with incomplete deps
	if (data.status && (data.status === 'assigned' || data.status === 'in_progress')) {
		const blockers = getDependenciesEnriched(id);
		if (blockers.length > 0) {
			const titles = blockers.map((b) => `"${b.title}" (${b.status})`).join(', ');
			throw new PMError(
				PM_ERRORS.PM_CONSTRAINT,
				`Cannot set status to ${data.status}: blocked by incomplete dependencies: ${titles}`
			);
		}
	}

	if (updates.length > 1) {
		values.push(id);
		db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
	}

	// Set dependencies if provided
	if (data.depends_on !== undefined) {
		setDependencies(id, data.depends_on);
	}

	const updatedPlanRaw = getPlanRaw(id)!;

	// Create version if content changed
	if (descriptionChanged || resultChanged || statusChanged) {
		createPlanVersion(id, updatedPlanRaw.description, updatedPlanRaw.result, updatedPlanRaw.status, 'user');
	}

	// Log activity
	const action = statusChanged ? 'plan_status_changed' : 'plan_updated';
	logActivity({
		project_id: updatedPlanRaw.project_id,
		actor: 'system',
		action,
		target_type: 'plan',
		target_id: id,
		target_title: updatedPlanRaw.title,
		details: statusChanged ? `Status changed to ${updatedPlanRaw.status}` : undefined
	});

	return {
		...updatedPlanRaw,
		depends_on: getDependencies(id),
		blocked_by: getDependenciesEnriched(id)
	};
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
// PLAN DEPENDENCIES
// ============================================================================

export function getDependencies(planId: number): number[] {
	const db = getDb();
	const rows = db
		.prepare('SELECT depends_on_plan_id FROM plan_dependencies WHERE plan_id = ? ORDER BY depends_on_plan_id')
		.all(planId) as Array<{ depends_on_plan_id: number }>;
	return rows.map((r) => r.depends_on_plan_id);
}

export function getDependenciesEnriched(
	planId: number
): Array<{ id: number; title: string; status: string }> {
	const db = getDb();
	return db
		.prepare(
			`SELECT p.id, p.title, p.status
			FROM plan_dependencies pd
			JOIN plans p ON pd.depends_on_plan_id = p.id
			WHERE pd.plan_id = ?
			AND p.status NOT IN ('complete', 'cancelled')
			ORDER BY p.id`
		)
		.all(planId) as Array<{ id: number; title: string; status: string }>;
}

export function getDependents(
	planId: number
): Array<{ id: number; title: string; status: string }> {
	const db = getDb();
	return db
		.prepare(
			`SELECT p.id, p.title, p.status
			FROM plan_dependencies pd
			JOIN plans p ON pd.plan_id = p.id
			WHERE pd.depends_on_plan_id = ?
			ORDER BY p.id`
		)
		.all(planId) as Array<{ id: number; title: string; status: string }>;
}

export function setDependencies(planId: number, dependsOn: number[]): void {
	const db = getDb();
	const plan = db.prepare('SELECT id, project_id FROM plans WHERE id = ?').get(planId) as
		| { id: number; project_id: number }
		| undefined;
	if (!plan) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Plan ${planId} not found`);
	}

	// Deduplicate and remove self
	const uniqueDeps = [...new Set(dependsOn)].filter((id) => id !== planId);

	if (uniqueDeps.length > 0) {
		// Validate all IDs exist and belong to same project
		const placeholders = uniqueDeps.map(() => '?').join(',');
		const existing = db
			.prepare(
				`SELECT id, project_id FROM plans WHERE id IN (${placeholders})`
			)
			.all(...uniqueDeps) as Array<{ id: number; project_id: number }>;

		if (existing.length !== uniqueDeps.length) {
			const foundIds = new Set(existing.map((e) => e.id));
			const missing = uniqueDeps.filter((id) => !foundIds.has(id));
			throw new PMError(
				PM_ERRORS.PM_CONSTRAINT,
				`Dependency plan(s) not found: ${missing.join(', ')}`
			);
		}

		const wrongProject = existing.filter((e) => e.project_id !== plan.project_id);
		if (wrongProject.length > 0) {
			throw new PMError(
				PM_ERRORS.PM_CONSTRAINT,
				`Dependency plan(s) belong to different project: ${wrongProject.map((p) => p.id).join(', ')}`
			);
		}

		// Cycle detection via DFS
		// Build adjacency: start with existing graph minus current plan's deps, then add proposed
		const allDeps = db
			.prepare('SELECT plan_id, depends_on_plan_id FROM plan_dependencies')
			.all() as Array<{ plan_id: number; depends_on_plan_id: number }>;

		const adj = new Map<number, Set<number>>();
		for (const row of allDeps) {
			if (row.plan_id === planId) continue; // skip current plan's old deps
			if (!adj.has(row.plan_id)) adj.set(row.plan_id, new Set());
			adj.get(row.plan_id)!.add(row.depends_on_plan_id);
		}
		// Add proposed deps
		adj.set(planId, new Set(uniqueDeps));

		// DFS cycle detection from planId
		const visited = new Set<number>();
		const recursionStack = new Set<number>();

		function hasCycle(node: number): boolean {
			visited.add(node);
			recursionStack.add(node);
			const neighbors = adj.get(node);
			if (neighbors) {
				for (const neighbor of neighbors) {
					if (!visited.has(neighbor)) {
						if (hasCycle(neighbor)) return true;
					} else if (recursionStack.has(neighbor)) {
						return true;
					}
				}
			}
			recursionStack.delete(node);
			return false;
		}

		// Check cycle starting from each node involved
		visited.clear();
		recursionStack.clear();
		if (hasCycle(planId)) {
			throw new PMError(
				PM_ERRORS.PM_CONSTRAINT,
				'Circular dependency detected'
			);
		}
	}

	// Replace deps in a transaction
	const transaction = db.transaction(() => {
		db.prepare('DELETE FROM plan_dependencies WHERE plan_id = ?').run(planId);
		if (uniqueDeps.length > 0) {
			const insert = db.prepare(
				'INSERT INTO plan_dependencies (plan_id, depends_on_plan_id) VALUES (?, ?)'
			);
			for (const depId of uniqueDeps) {
				insert.run(planId, depId);
			}
		}
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
