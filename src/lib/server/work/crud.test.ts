// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	closeWorkDb,
	createWorkItem,
	deleteWorkCategory,
	getWorkItem,
	listWorkChangeLog,
	listWorkCategories,
	resetWorkSchemaForTests,
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
			type: 'next_step',
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
			type: 'next_step',
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
			(entry) => entry.entity_type === 'next_step' && entry.entity_id === String(nextStep.id)
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
