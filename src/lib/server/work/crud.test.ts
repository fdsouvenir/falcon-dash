// @vitest-environment node

import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	closeWorkDb,
	createWorkBlockerLink,
	createWorkItem,
	deleteWorkBlockerLink,
	deleteWorkCategory,
	getWorkItem,
	listWorkBlockerLinks,
	listWorkChangeLog,
	listWorkCategories,
	resetWorkSchemaForTests,
	updateWorkBlockerLink,
	updateWorkItem,
	upsertWorkCategory
} from './index.js';

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'falcon-work-crud-'));
	process.env.FALCON_DASH_WORK_DATABASE_PATH = join(tempDir, 'work.db');
	closeWorkDb();
	resetWorkSchemaForTests();
});

afterEach(() => {
	closeWorkDb();
	resetWorkSchemaForTests();
	delete process.env.FALCON_DASH_WORK_DATABASE_PATH;
	rmSync(tempDir, { recursive: true, force: true });
});

describe('Work category CRUD', () => {
	it('deletes a subcategory and unassigns linked Work items', () => {
		const category = upsertWorkCategory({
			kind: 'category',
			title: 'Condo'
		});
		const subcategory = upsertWorkCategory({
			kind: 'subcategory',
			parent_category_id: category.id,
			title: 'HOA and building'
		});
		const item = createWorkItem({
			type: 'project',
			title: 'Review board notices',
			area_id: subcategory.id
		});

		const result = deleteWorkCategory(subcategory.id);

		expect(result).toMatchObject({
			deleted: true,
			deleted_categories: 1,
			unassigned_items: 1
		});
		expect(getWorkItem(item.id)).toMatchObject({
			area_id: null,
			category_id: null,
			subcategory_id: null
		});
		expect(listWorkCategories().map((entry) => entry.id)).not.toContain(subcategory.id);
		expect(listWorkCategories().map((entry) => entry.id)).toContain(category.id);
	});

	it('deletes a category, its subcategories, and unassigns all linked Work items', () => {
		const category = upsertWorkCategory({
			kind: 'category',
			title: 'Personal'
		});
		const subcategory = upsertWorkCategory({
			kind: 'subcategory',
			parent_category_id: category.id,
			title: 'Money and admin'
		});
		const categoryItem = createWorkItem({
			type: 'project',
			title: 'Renew documents',
			area_id: category.id
		});
		const subcategoryItem = createWorkItem({
			type: 'task',
			title: 'Pay assessment',
			area_id: subcategory.id
		});

		const result = deleteWorkCategory(category.id);

		expect(result).toMatchObject({
			deleted: true,
			deleted_categories: 2,
			unassigned_items: 2
		});
		expect(getWorkItem(categoryItem.id)?.area_id).toBeNull();
		expect(getWorkItem(subcategoryItem.id)?.area_id).toBeNull();
		expect(listWorkCategories()).toHaveLength(0);
	});
});

describe('Work change log', () => {
	it('migrates existing next_step Work rows to tasks in place', () => {
		const dbPath = process.env.FALCON_DASH_WORK_DATABASE_PATH!;
		closeWorkDb();
		rmSync(dbPath, { force: true });
		const oldDb = new Database(dbPath);
		oldDb.exec(`
			CREATE TABLE work_areas (
			  id TEXT PRIMARY KEY,
			  title TEXT NOT NULL,
			  description TEXT,
			  parent_area_id TEXT,
			  status TEXT NOT NULL DEFAULT 'active',
			  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
			);
			CREATE TABLE work_items (
			  id INTEGER PRIMARY KEY AUTOINCREMENT,
			  type TEXT NOT NULL CHECK(type IN ('project','milestone','next_step','open_question','decision','automation','finding','change_request')),
			  area_id TEXT,
			  parent_item_id INTEGER,
			  title TEXT NOT NULL,
			  description TEXT,
			  body TEXT,
			  status TEXT NOT NULL DEFAULT 'backlog',
			  owner TEXT,
			  waiting_on TEXT,
			  priority TEXT,
			  next_action TEXT,
			  approval_required INTEGER NOT NULL DEFAULT 0,
			  due_date TEXT,
			  scheduled_at TEXT,
			  stale_after TEXT,
			  result TEXT,
			  legacy_project_id INTEGER,
			  legacy_plan_id INTEGER,
			  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
			  last_activity_at INTEGER NOT NULL DEFAULT (unixepoch())
			);
			CREATE TABLE work_project_details (
			  work_item_id INTEGER PRIMARY KEY,
			  goal TEXT,
			  definition_of_done TEXT,
			  why_it_matters TEXT,
			  scope TEXT,
			  non_scope TEXT,
			  health TEXT,
			  operator TEXT,
			  start_date TEXT,
			  target_date TEXT,
			  actual_completed_date TEXT,
			  current_next_step_id INTEGER,
			  last_meaningful_update_at INTEGER
			);
			CREATE TABLE work_next_step_details (
			  work_item_id INTEGER PRIMARY KEY,
			  action TEXT
			);
			INSERT INTO work_items (id, type, title, status, parent_item_id, priority, created_at, updated_at, last_activity_at)
			VALUES
			  (1, 'project', 'Existing project', 'in_progress', NULL, 'normal', 1, 1, 1),
			  (2, 'next_step', 'Existing task', 'ready', 1, 'normal', 1, 1, 1);
			INSERT INTO work_project_details (work_item_id, current_next_step_id)
			VALUES (1, 2);
			INSERT INTO work_next_step_details (work_item_id, action)
			VALUES (2, 'Do the existing task');
		`);
		oldDb.close();

		resetWorkSchemaForTests();

		expect(getWorkItem(2)).toMatchObject({
			type: 'task',
			task_action: 'Do the existing task'
		});
		expect(getWorkItem(1)).toMatchObject({
			current_next_item_id: 2
		});
	});

	it('records project-scoped changes for child Work items', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Condo board packet'
		});
		const milestone = createWorkItem({
			type: 'milestone',
			title: 'Board review ready',
			parent_item_id: project.id
		});
		const nextStep = createWorkItem({
			type: 'task',
			title: 'Compare assessment options',
			parent_item_id: milestone.id,
			status: 'ready'
		});

		updateWorkItem(nextStep.id, {
			status: 'in_progress',
			priority: 'high',
			actor: 'operator'
		});

		const projectLog = listWorkChangeLog({ project_id: project.id });
		const update = projectLog.find(
			(entry) => entry.entity_type === 'task' && entry.entity_id === String(nextStep.id)
		);
		expect(update).toMatchObject({
			action: 'updated',
			project_id: project.id,
			parent_item_id: milestone.id,
			actor: 'operator'
		});
		expect(update?.changes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: 'status',
					from: 'ready',
					to: 'in_progress'
				}),
				expect.objectContaining({
					field: 'priority',
					from: 'normal',
					to: 'high'
				})
			])
		);
	});

	it('captures type-specific fields in item updates', () => {
		const question = createWorkItem({
			type: 'open_question',
			title: 'Which contractor owns the inspection?',
			question_text: 'Which contractor owns the inspection?',
			why_it_matters: 'The schedule cannot be confirmed without an owner.',
			answerer: 'operator'
		});

		updateWorkItem(question.id, {
			answer: 'Use the HVAC vendor.',
			status: 'complete',
			actor: 'operator'
		});

		const [entry] = listWorkChangeLog({
			entity_type: 'open_question',
			entity_id: question.id,
			limit: 1
		});
		expect(entry).toMatchObject({
			action: 'completed',
			entity_title: question.title
		});
		expect(entry.changes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					field: 'answer',
					to: 'Use the HVAC vendor.'
				})
			])
		);
	});

	it('validates project current next item pointers', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Client launch'
		});
		const task = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Send launch brief',
			status: 'ready'
		});
		const otherProject = createWorkItem({
			type: 'project',
			title: 'Other launch'
		});
		const otherTask = createWorkItem({
			type: 'task',
			parent_item_id: otherProject.id,
			title: 'Unrelated task',
			status: 'ready'
		});

		expect(updateWorkItem(project.id, { current_next_item_id: task.id })).toMatchObject({
			current_next_item_id: task.id
		});
		expect(() => updateWorkItem(project.id, { current_next_item_id: otherTask.id })).toThrow(
			/current_next_item_id must belong to the project/
		);
		expect(() => updateWorkItem(project.id, { current_next_item_id: otherProject.id })).toThrow(
			/current_next_item_id must point to a task/
		);
	});

	it('prevents tasks from becoming nested mini-projects', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Operator handoff'
		});
		const task = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Call Maya',
			status: 'ready'
		});

		expect(() =>
			createWorkItem({
				type: 'task',
				parent_item_id: task.id,
				title: 'Ask about launch order',
				status: 'ready'
			})
		).toThrow(/tasks cannot have child tasks/);
	});

	it('records category deletion as a directory change with unassignment metadata', () => {
		const category = upsertWorkCategory({
			kind: 'category',
			title: 'Condo'
		});
		const item = createWorkItem({
			type: 'project',
			title: 'Review reserve study',
			area_id: category.id
		});

		deleteWorkCategory(category.id);

		const [entry] = listWorkChangeLog({
			entity_type: 'category',
			entity_id: category.id,
			limit: 1
		});
		expect(entry).toMatchObject({
			action: 'deleted',
			entity_title: 'Condo',
			area_id: category.id,
			metadata: expect.objectContaining({
				unassigned_items: 1
			})
		});
		expect(getWorkItem(item.id)?.area_id).toBeNull();
	});
});

describe('Work blocker links', () => {
	it('creates, resolves, and deletes an explicit external blocker link', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Lake trip'
		});
		const nextStep = createWorkItem({
			type: 'task',
			title: 'Confirm pet care',
			parent_item_id: project.id
		});

		const blocker = createWorkBlockerLink({
			blocked_item_id: nextStep.id,
			blocker_source: 'person',
			external_label: 'Jamie',
			reason: 'Dog care is not confirmed.',
			unblock_action: 'Ask Jamie for Friday confirmation.',
			actor: 'agent'
		});

		expect(blocker).toMatchObject({
			project_id: project.id,
			blocked_item_id: nextStep.id,
			blocker_source: 'person',
			external_label: 'Jamie',
			blocked_item_title: 'Confirm pet care',
			status: 'active'
		});
		expect(() =>
			createWorkBlockerLink({
				blocked_item_id: nextStep.id,
				blocker_source: 'person',
				external_label: 'Jamie'
			})
		).toThrow(/already exists/);

		const resolved = updateWorkBlockerLink(blocker.id, { status: 'resolved', actor: 'operator' });
		expect(resolved).toMatchObject({ status: 'resolved' });
		expect(resolved?.resolved_at).toBeTruthy();
		expect(listWorkBlockerLinks({ project_id: project.id })).toHaveLength(0);
		expect(listWorkBlockerLinks({ project_id: project.id, status: 'all' })).toHaveLength(1);

		expect(deleteWorkBlockerLink(blocker.id)?.id).toBe(blocker.id);
		expect(listWorkBlockerLinks({ project_id: project.id, status: 'all' })).toHaveLength(0);
	});

	it('creates a Work-item blocker link from an open question blocked_item_id', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Condo repair'
		});
		const milestone = createWorkItem({
			type: 'milestone',
			title: 'Vendor selected',
			parent_item_id: project.id
		});
		const question = createWorkItem({
			type: 'open_question',
			title: 'Can the plumber come Friday?',
			parent_item_id: milestone.id,
			blocked_item_id: milestone.id,
			question_text: 'Can the plumber come Friday?',
			why_it_matters: 'The vendor date gates the repair milestone.',
			answerer: 'external',
			status: 'waiting',
			waiting_on: 'external'
		});

		const blockers = listWorkBlockerLinks({ project_id: project.id });
		expect(blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					blocked_item_id: milestone.id,
					blocker_source: 'work_item',
					blocker_item_id: question.id,
					reason: 'The vendor date gates the repair milestone.',
					status: 'active'
				}),
				expect.objectContaining({
					blocked_item_id: question.id,
					blocker_source: 'external',
					external_label: 'External party',
					status: 'active'
				})
			])
		);

		resetWorkSchemaForTests();
		expect(listWorkBlockerLinks({ project_id: project.id })).toHaveLength(2);
	});

	it('resolves implicit waiting blocker links when the item is no longer waiting', () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Client launch'
		});
		const step = createWorkItem({
			type: 'task',
			title: 'Wait for DNS update',
			parent_item_id: project.id,
			status: 'waiting',
			waiting_on: 'system',
			next_action: 'Confirm DNS propagation'
		});

		expect(listWorkBlockerLinks({ project_id: project.id })).toEqual([
			expect.objectContaining({
				blocked_item_id: step.id,
				blocker_source: 'system',
				external_label: 'System',
				unblock_action: 'Confirm DNS propagation',
				status: 'active'
			})
		]);

		updateWorkItem(step.id, {
			status: 'ready',
			waiting_on: null
		});

		expect(listWorkBlockerLinks({ project_id: project.id })).toHaveLength(0);
		expect(listWorkBlockerLinks({ project_id: project.id, status: 'all' })).toEqual([
			expect.objectContaining({
				blocked_item_id: step.id,
				status: 'resolved'
			})
		]);
	});

	it('rejects invalid blocker link shapes', () => {
		const item = createWorkItem({
			type: 'task',
			title: 'Pick a lender'
		});

		expect(() =>
			createWorkBlockerLink({
				blocked_item_id: item.id,
				blocker_source: 'work_item'
			})
		).toThrow(/blocker_item_id is required/);
		expect(() =>
			createWorkBlockerLink({
				blocked_item_id: item.id,
				blocker_source: 'external'
			})
		).toThrow(/external_label is required/);
	});
});
