import type Database from 'better-sqlite3';
import { addEvidenceRef, createWorkItem, getWorkItemByLegacy, upsertWorkArea } from './crud.js';
import { getWorkDb, openLegacyPmDb } from './database.js';
import type { WorkItem, WorkItemType, WorkMigrationPreview, WorkStatus } from './types.js';

interface LegacyCategory {
	id: string;
	name: string;
	description: string | null;
	color?: string | null;
	sort_order?: number | null;
	created_at?: number | null;
}

interface LegacySubcategory {
	id: string;
	category_id: string;
	name: string;
	description: string | null;
	sort_order?: number | null;
	created_at?: number | null;
}

interface LegacyProject {
	id: number;
	category_id: string;
	subcategory_id: string | null;
	title: string;
	description: string | null;
	body: string | null;
	status: string;
	due_date: string | null;
	priority: string | null;
	external_ref?: string | null;
	version?: number | null;
	created_at?: number | null;
	updated_at?: number | null;
	last_activity_at?: number | null;
}

interface LegacyPlan {
	id: number;
	project_id: number;
	title: string;
	description: string | null;
	result: string | null;
	status: string;
	sort_order?: number | null;
	version?: number | null;
	created_by: string;
	created_at?: number | null;
	updated_at?: number | null;
}

interface LegacyPlanVersion {
	id: number;
	plan_id: number;
	version: number;
	description: string | null;
	result: string | null;
	status: string | null;
	created_by: string | null;
	created_at: number | null;
}

interface LegacyPlanDependency {
	plan_id: number;
	depends_on_plan_id: number;
	created_at: number | null;
}

interface LegacyActivity {
	id: number;
	project_id: number;
	actor: string;
	action: string;
	target_type: string;
	target_id: number;
	target_title: string | null;
	details: string | null;
	created_at: number;
}

interface LegacySnapshot {
	categories: LegacyCategory[];
	subcategories: LegacySubcategory[];
	projects: LegacyProject[];
	plans: LegacyPlan[];
	planVersions: LegacyPlanVersion[];
	planDependencies: LegacyPlanDependency[];
	activities: LegacyActivity[];
}

export function previewWorkMigration(
	sourceDb: Database.Database = openLegacyPmDb()
): WorkMigrationPreview {
	const snapshot = readLegacySnapshot(sourceDb);
	const projectIds = new Set(snapshot.projects.map((project) => project.id));
	const planIds = new Set(snapshot.plans.map((plan) => plan.id));

	const areas = [
		...snapshot.categories.map((category) => ({
			legacy_type: 'category',
			legacy_id: category.id,
			id: areaIdForCategory(category.id),
			title: category.name
		})),
		...snapshot.subcategories.map((subcategory) => ({
			legacy_type: 'subcategory',
			legacy_id: subcategory.id,
			id: areaIdForSubcategory(subcategory.id),
			title: subcategory.name
		}))
	];

	const items = [
		...snapshot.projects.map((project) => ({
			legacy_type: 'project',
			legacy_id: String(project.id),
			type: 'project' as const,
			title: project.title,
			status: mapProjectStatus(project.status),
			area_id: project.subcategory_id
				? areaIdForSubcategory(project.subcategory_id)
				: areaIdForCategory(project.category_id)
		})),
		...snapshot.plans.map((plan) => ({
			legacy_type: 'plan',
			legacy_id: String(plan.id),
			type: classifyPlan(plan),
			title: plan.title,
			status: mapPlanStatus(plan),
			parent_legacy_id: String(plan.project_id)
		}))
	];

	const observations = snapshot.activities.map((activity) => ({
		legacy_type: 'activity',
		legacy_id: String(activity.id),
		title: `${activity.action} ${activity.target_type}`,
		source_ref: `pm:activity:${activity.id}`
	}));

	const counts: Record<string, number> = {
		areas: areas.length,
		projects: snapshot.projects.length,
		plans: snapshot.plans.length,
		planVersions: snapshot.planVersions.length,
		planDependencies: snapshot.planDependencies.length,
		observations: observations.length,
		items: items.length
	};
	for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;

	const warnings = buildWarnings(snapshot, projectIds, planIds);

	return {
		generated_at: Math.floor(Date.now() / 1000),
		counts,
		areas,
		items,
		observations,
		warnings,
		self_review: buildSelfReview(snapshot, counts, warnings)
	};
}

export function applyWorkMigration(
	sourceDb: Database.Database = openLegacyPmDb(),
	targetDb: Database.Database = getWorkDb()
): WorkMigrationPreview {
	const preview = previewWorkMigration(sourceDb);
	const snapshot = readLegacySnapshot(sourceDb);

	const tx = targetDb.transaction(() => {
		for (const category of snapshot.categories) {
			upsertWorkArea({
				id: areaIdForCategory(category.id),
				title: category.name,
				description: category.description
			});
			mapLegacy(targetDb, 'category', category.id, 'area', areaIdForCategory(category.id));
		}

		for (const subcategory of snapshot.subcategories) {
			upsertWorkArea({
				id: areaIdForSubcategory(subcategory.id),
				title: subcategory.name,
				description: subcategory.description,
				parent_area_id: areaIdForCategory(subcategory.category_id)
			});
			mapLegacy(
				targetDb,
				'subcategory',
				subcategory.id,
				'area',
				areaIdForSubcategory(subcategory.id)
			);
		}

		const projectMap = new Map<number, WorkItem>();
		for (const project of snapshot.projects) {
			let item = getWorkItemByLegacy('project', project.id);
			if (!item) {
				item = createWorkItem({
					type: 'project',
					area_id: project.subcategory_id
						? areaIdForSubcategory(project.subcategory_id)
						: areaIdForCategory(project.category_id),
					title: project.title,
					description: project.description,
					body: renderProjectBody(project),
					status: mapProjectStatus(project.status),
					priority: (project.priority as WorkItem['priority']) ?? 'normal',
					due_date: project.due_date,
					legacy_project_id: project.id,
					actor: 'migration'
				});
			}
			projectMap.set(project.id, item);
			mapLegacy(targetDb, 'project', String(project.id), 'work_item', String(item.id));
			addEvidenceRef({
				work_item_id: item.id,
				source_type: 'legacy_pm',
				source_ref: `pm:project:${project.id}`,
				summary: 'Migrated from archived Falcon Dash PM project'
			});
		}

		const planMap = new Map<number, WorkItem>();
		for (const plan of snapshot.plans) {
			let item = getWorkItemByLegacy('plan', plan.id);
			const parent =
				projectMap.get(plan.project_id) ?? getWorkItemByLegacy('project', plan.project_id);
			const versions = snapshot.planVersions.filter((version) => version.plan_id === plan.id);
			if (!item) {
				item = createWorkItem({
					type: classifyPlan(plan),
					parent_item_id: parent?.id ?? null,
					area_id: parent?.area_id ?? null,
					title: plan.title,
					description: plan.description,
					body: renderPlanBody(plan, versions),
					status: mapPlanStatus(plan),
					result: plan.result,
					legacy_project_id: plan.project_id,
					legacy_plan_id: plan.id,
					approval_required: ['planning', 'needs_review'].includes(plan.status),
					waiting_on: plan.status === 'needs_review' ? 'fred' : null,
					actor: 'migration'
				});
			}
			planMap.set(plan.id, item);
			mapLegacy(targetDb, 'plan', String(plan.id), 'work_item', String(item.id));
			addEvidenceRef({
				work_item_id: item.id,
				source_type: 'legacy_pm',
				source_ref: `pm:plan:${plan.id}`,
				summary: 'Migrated from archived Falcon Dash PM plan'
			});
		}

		for (const dependency of snapshot.planDependencies) {
			const from = planMap.get(dependency.plan_id);
			const to = planMap.get(dependency.depends_on_plan_id);
			if (!from || !to) continue;
			targetDb
				.prepare(
					`INSERT OR IGNORE INTO work_relationships
					 (from_item_id, to_item_id, relation_type, created_at)
					 VALUES (?, ?, 'depends_on', ?)`
				)
				.run(from.id, to.id, dependency.created_at ?? Math.floor(Date.now() / 1000));
		}

		for (const activity of snapshot.activities) {
			const existing = targetDb
				.prepare(
					"SELECT work_id FROM work_migration_map WHERE legacy_type = 'activity' AND legacy_id = ?"
				)
				.get(String(activity.id)) as { work_id: string } | undefined;
			if (existing) continue;

			const result = targetDb
				.prepare(
					`INSERT INTO work_observations
					 (title, summary, source_type, source_ref, observed_at, created_at)
					 VALUES (?, ?, ?, ?, ?, ?)`
				)
				.run(
					`${activity.action} ${activity.target_type}`,
					renderActivitySummary(activity),
					'legacy_pm',
					`pm:activity:${activity.id}`,
					activity.created_at,
					Math.floor(Date.now() / 1000)
				);
			const observationId = result.lastInsertRowid as number;
			mapLegacy(targetDb, 'activity', String(activity.id), 'observation', String(observationId));
			addEvidenceRef({
				observation_id: observationId,
				source_type: 'legacy_pm',
				source_ref: `pm:activity:${activity.id}`,
				summary: activity.details ?? activity.target_title
			});
		}

		targetDb
			.prepare(
				`INSERT INTO work_meta (key, value, updated_at)
				 VALUES ('source_of_truth', 'work', unixepoch())
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
			)
			.run();
		targetDb
			.prepare(
				`INSERT INTO work_meta (key, value, updated_at)
				 VALUES ('last_migration_at', ?, unixepoch())
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
			)
			.run(String(Math.floor(Date.now() / 1000)));
		targetDb
			.prepare(
				`INSERT INTO work_meta (key, value, updated_at)
				 VALUES ('migration_self_review', ?, unixepoch())
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
			)
			.run(JSON.stringify(preview.self_review));
	});

	tx();
	return preview;
}

export function isWorkSourceOfTruth(db: Database.Database = getWorkDb()): boolean {
	const row = db.prepare("SELECT value FROM work_meta WHERE key = 'source_of_truth'").get() as
		| { value: string }
		| undefined;
	return row?.value === 'work';
}

function readLegacySnapshot(sourceDb: Database.Database): LegacySnapshot {
	return {
		categories: sourceDb
			.prepare(
				'SELECT id, name, description, color, sort_order, created_at FROM categories ORDER BY sort_order'
			)
			.all() as LegacyCategory[],
		subcategories: sourceDb
			.prepare(
				'SELECT id, category_id, name, description, sort_order, created_at FROM subcategories ORDER BY sort_order'
			)
			.all() as LegacySubcategory[],
		projects: sourceDb.prepare('SELECT * FROM projects ORDER BY id').all() as LegacyProject[],
		plans: sourceDb.prepare('SELECT * FROM plans ORDER BY id').all() as LegacyPlan[],
		planVersions: tableExists(sourceDb, 'plan_versions')
			? (sourceDb
					.prepare('SELECT * FROM plan_versions ORDER BY plan_id, version')
					.all() as LegacyPlanVersion[])
			: [],
		planDependencies: tableExists(sourceDb, 'plan_dependencies')
			? (sourceDb
					.prepare('SELECT * FROM plan_dependencies ORDER BY plan_id, depends_on_plan_id')
					.all() as LegacyPlanDependency[])
			: [],
		activities: sourceDb.prepare('SELECT * FROM activities ORDER BY id').all() as LegacyActivity[]
	};
}

function tableExists(db: Database.Database, table: string): boolean {
	const row = db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(table);
	return Boolean(row);
}

function classifyPlan(plan: LegacyPlan): WorkItemType {
	const text = `${plan.title}\n${plan.description ?? ''}\n${plan.result ?? ''}`.toLowerCase();
	const title = plan.title.toLowerCase();
	if (
		/\b(morning brief|heartbeat|cron|sweep|routine|recurring|scan)\b/.test(title) ||
		(/\b(sweep|scan|cron|heartbeat)\b/.test(text) && plan.status === 'assigned')
	) {
		return 'routine';
	}
	if (plan.status === 'needs_review') return 'decision';
	if (/\b(decide|decision|review|approve|approval|select|choose|feedback)\b/.test(text)) {
		return 'decision';
	}
	if (
		/\b(change|schema|migration|deploy|deployment|config|code|implementation|refactor|slice)\b/.test(
			text
		)
	) {
		return 'change';
	}
	return 'task';
}

function mapProjectStatus(status: string): WorkStatus {
	switch (status) {
		case 'todo':
			return 'backlog';
		case 'review':
			return 'needs_review';
		case 'done':
			return 'complete';
		case 'cancelled':
			return 'cancelled';
		case 'archived':
			return 'archived';
		case 'in_progress':
			return 'in_progress';
		default:
			return 'backlog';
	}
}

function mapPlanStatus(plan: LegacyPlan): WorkStatus {
	if (classifyPlan(plan) === 'routine' && plan.status === 'assigned') return 'scheduled';
	switch (plan.status) {
		case 'planning':
			return 'planning';
		case 'assigned':
			return 'ready';
		case 'in_progress':
			return 'in_progress';
		case 'needs_review':
			return 'needs_review';
		case 'complete':
			return 'complete';
		case 'cancelled':
			return 'cancelled';
		default:
			return 'backlog';
	}
}

function areaIdForCategory(id: string): string {
	return `area:category:${id}`;
}

function areaIdForSubcategory(id: string): string {
	return `area:subcategory:${id}`;
}

function mapLegacy(
	db: Database.Database,
	legacyType: string,
	legacyId: string,
	workType: string,
	workId: string
): void {
	db.prepare(
		`INSERT INTO work_migration_map (legacy_type, legacy_id, work_type, work_id, created_at)
		 VALUES (?, ?, ?, ?, unixepoch())
		 ON CONFLICT(legacy_type, legacy_id) DO UPDATE SET
		   work_type = excluded.work_type,
		   work_id = excluded.work_id`
	).run(legacyType, legacyId, workType, workId);
}

function renderProjectBody(project: LegacyProject): string | null {
	const parts = [project.body];
	if (project.external_ref) parts.push(`Legacy external ref: ${project.external_ref}`);
	return parts.filter(Boolean).join('\n\n') || null;
}

function renderPlanBody(plan: LegacyPlan, versions: LegacyPlanVersion[]): string | null {
	const parts = [plan.description];
	if (versions.length > 0) {
		parts.push(
			[
				'## Legacy Version History',
				...versions.map(
					(version) =>
						`- v${version.version} [${version.status ?? 'unknown'}] by ${version.created_by ?? 'system'} at ${
							version.created_at ?? 'unknown'
						}${version.description ? `\n  Description: ${version.description}` : ''}${
							version.result ? `\n  Result: ${version.result}` : ''
						}`
				)
			].join('\n')
		);
	}
	return parts.filter(Boolean).join('\n\n') || null;
}

function renderActivitySummary(activity: LegacyActivity): string {
	return [
		activity.details,
		activity.target_title ? `Target: ${activity.target_title}` : null,
		`Actor: ${activity.actor}`
	]
		.filter(Boolean)
		.join('\n');
}

function buildWarnings(
	snapshot: LegacySnapshot,
	projectIds: Set<number>,
	planIds: Set<number>
): string[] {
	const warnings: string[] = [];
	const categoryIds = new Set(snapshot.categories.map((category) => category.id));
	const subcategoryIds = new Set(snapshot.subcategories.map((subcategory) => subcategory.id));

	for (const subcategory of snapshot.subcategories) {
		if (!categoryIds.has(subcategory.category_id)) {
			warnings.push(
				`Subcategory ${subcategory.id} references missing category ${subcategory.category_id}`
			);
		}
	}
	for (const project of snapshot.projects) {
		if (!categoryIds.has(project.category_id)) {
			warnings.push(`Project ${project.id} references missing category ${project.category_id}`);
		}
		if (project.subcategory_id && !subcategoryIds.has(project.subcategory_id)) {
			warnings.push(
				`Project ${project.id} references missing subcategory ${project.subcategory_id}`
			);
		}
	}
	for (const plan of snapshot.plans) {
		if (!projectIds.has(plan.project_id)) {
			warnings.push(`Plan ${plan.id} references missing project ${plan.project_id}`);
		}
	}
	for (const version of snapshot.planVersions) {
		if (!planIds.has(version.plan_id)) {
			warnings.push(`Plan version ${version.id} references missing plan ${version.plan_id}`);
		}
	}
	for (const dependency of snapshot.planDependencies) {
		if (!planIds.has(dependency.plan_id)) {
			warnings.push(`Plan dependency references missing plan ${dependency.plan_id}`);
		}
		if (!planIds.has(dependency.depends_on_plan_id)) {
			warnings.push(
				`Plan dependency references missing dependency ${dependency.depends_on_plan_id}`
			);
		}
	}
	for (const activity of snapshot.activities) {
		if (!projectIds.has(activity.project_id)) {
			warnings.push(`Activity ${activity.id} references missing project ${activity.project_id}`);
		}
	}
	return warnings;
}

function buildSelfReview(
	snapshot: LegacySnapshot,
	counts: Record<string, number>,
	warnings: string[]
): string[] {
	const review = [
		`Legacy categories mapped to Work areas: ${snapshot.categories.length}.`,
		`Legacy subcategories mapped to child Work areas: ${snapshot.subcategories.length}.`,
		`Legacy projects mapped to Work project items: ${snapshot.projects.length}.`,
		`Legacy plans mapped to Work change/task/decision/routine items: ${snapshot.plans.length}.`,
		`Legacy plan dependencies mapped to Work depends_on relationships: ${snapshot.planDependencies.length}.`,
		`Legacy plan versions preserved inside migrated Work item body: ${snapshot.planVersions.length}.`,
		`Legacy activities mapped to observations/evidence: ${snapshot.activities.length}.`,
		`Mapped Work item type counts: ${JSON.stringify(
			Object.fromEntries(
				Object.entries(counts).filter(([key]) =>
					['project', 'change', 'task', 'decision', 'routine', 'observation'].includes(key)
				)
			)
		)}.`
	];
	if (warnings.length === 0) {
		review.push('Self-review found no broken foreign-key references in legacy PM source tables.');
	} else {
		review.push(
			`Self-review found ${warnings.length} warning(s); migration can proceed but review is required.`
		);
	}
	return review;
}
