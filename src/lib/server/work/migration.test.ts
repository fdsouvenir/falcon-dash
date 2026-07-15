// @vitest-environment node

import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	applyWorkMigration,
	closeWorkDb,
	createWorkItem,
	generateAndWriteContext,
	generateWorkContext,
	generateWorkItemContext,
	getWorkDb,
	getWorkItemByLegacy,
	isWorkSourceOfTruth,
	listWorkItems,
	listWorkQueue,
	previewWorkMigration,
	resetWorkSchemaForTests
} from './index.js';

let tempDir: string;
let legacyDb: Database.Database;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'falcon-work-'));
	process.env.FALCON_DASH_WORK_DATABASE_PATH = join(tempDir, 'work.db');
	process.env.FALCON_DASH_WORK_CONTEXT_DIR = join(tempDir, 'context');
	process.env.FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH = join(tempDir, 'source.db');
	process.env.FALCON_DASH_WORK_SKIP_WORKSPACE_SYMLINKS = '1';
	closeWorkDb();
	resetWorkSchemaForTests();

	legacyDb = new Database(process.env.FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH);
	createLegacyPmSchema(legacyDb);
});

afterEach(() => {
	legacyDb.close();
	closeWorkDb();
	resetWorkSchemaForTests();
	delete process.env.FALCON_DASH_WORK_DATABASE_PATH;
	delete process.env.FALCON_DASH_WORK_CONTEXT_DIR;
	delete process.env.FALCON_DASH_ARCHIVED_WORK_SOURCE_DATABASE_PATH;
	delete process.env.FALCON_DASH_WORK_SKIP_WORKSPACE_SYMLINKS;
	delete process.env.ORIGIN;
	rmSync(tempDir, { recursive: true, force: true });
});

describe('Work migration', () => {
	it('previews legacy PM data as Work objects with self-review', () => {
		seedLegacyPm(legacyDb);

		const preview = previewWorkMigration(legacyDb);

		expect(preview.counts.areas).toBe(2);
		expect(
			preview.items.some((item) => item.type === 'project' && item.title === 'Falcon reset')
		).toBe(true);
		expect(
			preview.items.some((item) => item.type === 'change_request' && item.title.includes('schema'))
		).toBe(true);
		expect(preview.items.some((item) => item.type === 'open_question')).toBe(true);
		expect(preview.items.some((item) => item.type === 'decision')).toBe(true);
		expect(preview.items.some((item) => item.type === 'automation')).toBe(true);
		expect(preview.counts.planVersions).toBe(1);
		expect(preview.counts.planDependencies).toBe(1);
		expect(preview.self_review.join('\n')).toContain('Self-review found no broken foreign-key');
	});

	it('migrates from old PM DB into a separate Work DB and marks Work as source of truth', () => {
		seedLegacyPm(legacyDb);

		const preview = applyWorkMigration(legacyDb, getWorkDb());
		const db = getWorkDb();

		expect(preview.counts.items).toBeGreaterThan(0);
		expect(isWorkSourceOfTruth(db)).toBe(true);
		expect(getWorkItemByLegacy('project', 1)?.type).toBe('project');
		expect(getWorkItemByLegacy('plan', 1)?.type).toBe('change_request');
		expect(getWorkItemByLegacy('plan', 4)?.type).toBe('open_question');
		expect(listWorkQueue().needsReview.length).toBeGreaterThan(0);
		expect(listWorkQueue().scheduledAutomations.length).toBeGreaterThan(0);
		expect(db.prepare('SELECT COUNT(*) as count FROM work_relationships').get()).toMatchObject({
			count: 1
		});
		expect(legacyDb.prepare('SELECT COUNT(*) as count FROM projects').get()).toMatchObject({
			count: 1
		});
		expect(
			legacyDb
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_items'")
				.get()
		).toBeUndefined();
	});

	it('can re-apply migration without duplicating Work items or evidence refs', () => {
		seedLegacyPm(legacyDb);
		applyWorkMigration(legacyDb, getWorkDb());
		const db = getWorkDb();
		const firstCounts = {
			items: db.prepare('SELECT COUNT(*) as count FROM work_items').get() as { count: number },
			evidence: db.prepare('SELECT COUNT(*) as count FROM work_evidence_refs').get() as {
				count: number;
			}
		};

		applyWorkMigration(legacyDb, db);

		expect(db.prepare('SELECT COUNT(*) as count FROM work_items').get()).toMatchObject(
			firstCounts.items
		);
		expect(db.prepare('SELECT COUNT(*) as count FROM work_evidence_refs').get()).toMatchObject(
			firstCounts.evidence
		);
	});

	it('lets agents create Work directly after migration', () => {
		seedLegacyPm(legacyDb);
		applyWorkMigration(legacyDb, getWorkDb());

		const item = createWorkItem({
			type: 'task',
			title: 'Write Work-first context',
			status: 'ready',
			owner: 'agent',
			next_action: 'Run the Work migration tests',
			actor: 'agent'
		});

		expect(item.id).toBeGreaterThan(0);
		expect(listWorkItems({ type: 'task' }).some((workItem) => workItem.title === item.title)).toBe(
			true
		);
		expect(generateWorkContext().markdown).toContain('Write Work-first context');
	});

	it('renders agent-ergonomic Work context with counts, empty states, and help', () => {
		const context = generateWorkContext().markdown;

		expect(context).toContain('## Summary');
		expect(context).toContain('active: 0');
		expect(context).toContain('types: 0 results');
		expect(context).toContain('## Next Actions (0)');
		expect(context).toContain('0 results.');
		expect(context).toContain('Create approved Change Request spec');
	});

	it('renders Work item detail with type references and update templates', () => {
		const item = createWorkItem({
			type: 'change_request',
			title: 'Adopt AXI context hints',
			status: 'planning',
			owner: 'agent',
			waiting_on: 'operator',
			approval_required: true,
			change_scope: 'Adopt AXI context hints',
			risk: 'low',
			verification_plan: 'Verify generated context output',
			next_action: 'Ask the operator to approve the generated context contract',
			actor: 'agent'
		});

		const context = generateWorkItemContext(item);

		expect(context).toContain(`# Change Request ${item.id}: Adopt AXI context hints`);
		expect(context).toContain(`context_file: Work/W-${item.id}.md`);
		expect(context).toContain('Mark approved Change Request ready after operator approval');
		expect(context).toContain('Complete with result');
	});

	it('rejects old public type names and incomplete controlled objects', () => {
		expect(() =>
			createWorkItem({
				type: 'next_step',
				title: 'Old next step noun',
				actor: 'agent'
			} as never)
		).toThrow('Invalid work type: next_step');

		expect(() =>
			createWorkItem({
				type: 'change_request',
				title: 'Incomplete change request',
				actor: 'agent'
			})
		).toThrow('change_scope is required');

		expect(() =>
			createWorkItem({
				type: 'decision',
				title: 'Choose deployment path',
				decision_question: 'Choose deployment path',
				recommended_option: 'Ship',
				consequence_of_no_decision: 'Deployment remains waiting.',
				actor: 'agent'
			})
		).toThrow('decision options require at least two choices');
	});

	it('writes Work-first context from the separate Work DB', () => {
		seedLegacyPm(legacyDb);
		applyWorkMigration(legacyDb, getWorkDb());

		const result = generateAndWriteContext();

		expect(result.filesWritten).toBeGreaterThan(0);
		expect(generateWorkContext().markdown).toContain(
			'Falcon Dash Work is the agent-facing source of truth'
		);
	});

	it('writes public dashboard links when ORIGIN is configured', () => {
		process.env.ORIGIN = 'https://falcon.example.com/';
		const project = createWorkItem({
			type: 'project',
			title: 'Linked project',
			status: 'in_progress',
			actor: 'agent'
		});
		const task = createWorkItem({
			type: 'task',
			title: 'Linked task',
			parent_item_id: project.id,
			status: 'ready',
			actor: 'agent'
		});
		const milestone = createWorkItem({
			type: 'milestone',
			title: 'Linked milestone',
			parent_item_id: project.id,
			status: 'in_progress',
			actor: 'agent'
		});

		const result = generateAndWriteContext();
		const falconDashContext = readFileSync(join(result.contextDir, 'FALCON-DASH.md'), 'utf8');
		const workApiDoc = readFileSync(join(result.contextDir, 'WORK-API.md'), 'utf8');
		const projectDoc = readFileSync(join(result.contextDir, 'Work', `W-${project.id}.md`), 'utf8');
		const taskDoc = readFileSync(join(result.contextDir, 'Work', `W-${task.id}.md`), 'utf8');
		const milestoneDoc = readFileSync(
			join(result.contextDir, 'Work', `W-${milestone.id}.md`),
			'utf8'
		);

		expect(falconDashContext).toContain('Public dashboard URL: https://falcon.example.com');
		expect(workApiDoc).toContain('Base URL: https://falcon.example.com/api/work');
		expect(workApiDoc).toContain('[Project 4](https://falcon.example.com/work/projects/4)');
		expect(projectDoc).toContain(
			`**Public URL:** https://falcon.example.com/work/projects/${project.id}`
		);
		expect(taskDoc).toContain(`**Public URL:** https://falcon.example.com/work/tasks/${task.id}`);
		expect(milestoneDoc).toContain(
			`**Public URL:** https://falcon.example.com/work/projects/${project.id}`
		);
		expect(falconDashContext).not.toContain('https://falcon.example.com//');
		expect(workApiDoc).not.toContain('https://falcon.example.com//');
	});

	it('omits public object links when ORIGIN is missing', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Plain project',
			status: 'ready',
			actor: 'agent'
		});

		const result = generateAndWriteContext();
		const falconDashContext = readFileSync(join(result.contextDir, 'FALCON-DASH.md'), 'utf8');
		const workApiDoc = readFileSync(join(result.contextDir, 'WORK-API.md'), 'utf8');
		const projectDoc = readFileSync(join(result.contextDir, 'Work', `W-${project.id}.md`), 'utf8');

		expect(falconDashContext).not.toContain('Public dashboard URL');
		expect(workApiDoc).toContain('Base URL: /api/work');
		expect(workApiDoc).toContain('use plain object references');
		expect(projectDoc).not.toContain('Public URL');
		expect(falconDashContext).not.toContain('http://localhost');
		expect(workApiDoc).not.toContain('http://localhost');
	});

	it('does not use local origins for public operator links', () => {
		process.env.ORIGIN = 'http://localhost:3000';
		const project = createWorkItem({
			type: 'project',
			title: 'Local project',
			status: 'ready',
			actor: 'agent'
		});

		const result = generateAndWriteContext();
		const workApiDoc = readFileSync(join(result.contextDir, 'WORK-API.md'), 'utf8');
		const projectDoc = readFileSync(join(result.contextDir, 'Work', `W-${project.id}.md`), 'utf8');

		expect(workApiDoc).toContain('Base URL: /api/work');
		expect(projectDoc).not.toContain('Public URL');
		expect(workApiDoc).not.toContain('http://localhost:3000');
	});
});

function createLegacyPmSchema(db: Database.Database): void {
	db.exec(`
		CREATE TABLE categories (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			color TEXT,
			sort_order INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (unixepoch())
		);
		CREATE TABLE subcategories (
			id TEXT PRIMARY KEY,
			category_id TEXT NOT NULL REFERENCES categories(id),
			name TEXT NOT NULL,
			description TEXT,
			sort_order INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (unixepoch())
		);
		CREATE TABLE projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			category_id TEXT NOT NULL REFERENCES categories(id),
			subcategory_id TEXT REFERENCES subcategories(id),
			title TEXT NOT NULL,
			description TEXT,
			body TEXT,
			status TEXT DEFAULT 'todo',
			due_date TEXT,
			priority TEXT,
			external_ref TEXT,
			version INTEGER DEFAULT 1,
			created_at INTEGER DEFAULT (unixepoch()),
			updated_at INTEGER DEFAULT (unixepoch()),
			last_activity_at INTEGER DEFAULT (unixepoch())
		);
		CREATE TABLE plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT,
			result TEXT,
			status TEXT DEFAULT 'planning',
			sort_order INTEGER DEFAULT 0,
			version INTEGER DEFAULT 1,
			created_by TEXT DEFAULT 'user',
			created_at INTEGER DEFAULT (unixepoch()),
			updated_at INTEGER DEFAULT (unixepoch())
		);
		CREATE TABLE plan_versions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
			version INTEGER NOT NULL,
			description TEXT,
			result TEXT,
			status TEXT,
			created_by TEXT DEFAULT 'system',
			created_at INTEGER DEFAULT (unixepoch())
		);
		CREATE TABLE plan_dependencies (
			plan_id INTEGER NOT NULL,
			depends_on_plan_id INTEGER NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			PRIMARY KEY (plan_id, depends_on_plan_id)
		);
		CREATE TABLE activities (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES projects(id),
			actor TEXT NOT NULL,
			action TEXT NOT NULL,
			target_type TEXT NOT NULL,
			target_id INTEGER NOT NULL,
			target_title TEXT,
			details TEXT,
			created_at INTEGER DEFAULT (unixepoch())
		);
	`);
}

function seedLegacyPm(db: Database.Database): void {
	db.prepare(
		"INSERT INTO categories (id, name, description, sort_order) VALUES ('falcon', 'Falcon Dash', 'Operator dashboard', 1)"
	).run();
	db.prepare(
		"INSERT INTO subcategories (id, category_id, name, description, sort_order) VALUES ('work-module', 'falcon', 'Work Module', 'Work schema and migration', 1)"
	).run();
	db.prepare(
		`INSERT INTO projects
		 (category_id, subcategory_id, title, status, priority, description, body)
		 VALUES ('falcon', 'work-module', 'Falcon reset', 'in_progress', 'high', 'Reset Falcon Dash around Work, Vault, and Channels', 'Project body')`
	).run();
	db.prepare(
		`INSERT INTO plans (project_id, title, description, status, created_by)
		 VALUES (1, 'Change 1: Work schema migration', 'Add Work schema, migration, API, and generated context.', 'in_progress', 'fred')`
	).run();
	db.prepare(
		`INSERT INTO plans (project_id, title, description, status, created_by)
		 VALUES (1, 'Review Work naming', 'Decision on Routine, Observation, and Change labels.', 'needs_review', 'fred')`
	).run();
	db.prepare(
		`INSERT INTO plans (project_id, title, description, status, created_by)
		 VALUES (1, 'Heartbeat routine', 'Recurring operator sweep for stale work.', 'assigned', 'fred')`
	).run();
	db.prepare(
		`INSERT INTO plans (project_id, title, description, status, created_by)
		 VALUES (1, 'Which automation trigger should Work use?', 'Unknown whether cron or heartbeat should own the sweep.', 'needs_review', 'fred')`
	).run();
	db.prepare(
		`INSERT INTO plan_versions (plan_id, version, description, result, status, created_by)
		 VALUES (1, 1, 'Original change plan', 'Initial result', 'in_progress', 'migration-test')`
	).run();
	db.prepare('INSERT INTO plan_dependencies (plan_id, depends_on_plan_id) VALUES (2, 1)').run();
	db.prepare(
		`INSERT INTO activities (project_id, actor, action, target_type, target_id, target_title, details)
		 VALUES (1, 'agent', 'plan_updated', 'plan', 1, 'Change 1: Work schema migration', 'Updated during migration test')`
	).run();
}
