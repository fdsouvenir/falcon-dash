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
	listWorkCategories,
	resetWorkSchemaForTests,
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
