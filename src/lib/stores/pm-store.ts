import { writable, derived, readonly, type Readable, type Writable } from 'svelte/store';
import { pmGet } from './pm-api.js';
import type { Project } from './pm-projects.js';
import type { Category, Subcategory } from './pm-categories.js';

// Feature detection via HTTP
const _pmAvailable: Writable<boolean> = writable(false);
export const pmAvailable: Readable<boolean> = readonly(_pmAvailable);

export async function checkPMAvailability(): Promise<void> {
	try {
		await pmGet('/api/pm/stats');
		_pmAvailable.set(true);
	} catch (err) {
		console.error('[PM] Availability check failed:', err);
		_pmAvailable.set(false);
	}
}

// Internal caches
const _categoryCache: Writable<Map<string, Category>> = writable(new Map());
const _subcategoryCache: Writable<Map<string, Subcategory>> = writable(new Map());
const _projectCache: Writable<Map<number, Project>> = writable(new Map());

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// Hydrate all caches
export async function hydratePMStores(): Promise<void> {
	try {
		const [categoriesRes, subcategoriesRes, projectsRes] = await Promise.all([
			pmGet<PaginatedResponse<Category>>('/api/pm/categories', { limit: '500' }),
			pmGet<PaginatedResponse<Subcategory>>('/api/pm/subcategories', { limit: '500' }),
			pmGet<PaginatedResponse<Project>>('/api/pm/projects', { limit: '500' })
		]);

		const categoryMap = new Map<string, Category>();
		for (const c of categoriesRes.items) categoryMap.set(c.id, c);
		_categoryCache.set(categoryMap);

		const subcategoryMap = new Map<string, Subcategory>();
		for (const s of subcategoriesRes.items) subcategoryMap.set(s.id, s);
		_subcategoryCache.set(subcategoryMap);

		const projectMap = new Map<number, Project>();
		for (const p of projectsRes.items) projectMap.set(p.id, p);
		_projectCache.set(projectMap);
	} catch (err) {
		console.error('[PM] Failed to hydrate PM stores:', err);
		_pmAvailable.set(false);
	}
}

// Derived: List view (flat sorted list)
export const listView: Readable<Project[]> = derived(_projectCache, ($cache) => {
	return Array.from($cache.values()).sort((a, b) => b.last_activity_at - a.last_activity_at);
});
