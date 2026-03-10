import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { pmGet, pmPost, pmPatch, pmDelete } from './pm-api.js';

// Re-export types for UI components
export interface Category {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	sort_order: number;
	created_at: number;
}

export interface Subcategory {
	id: string;
	category_id: string;
	name: string;
	description: string | null;
	sort_order: number;
	created_at: number;
}

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// Internal stores
const _categories: Writable<Category[]> = writable([]);
const _subcategories: Writable<Subcategory[]> = writable([]);
const _loading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);

// Public readonly
export const categories: Readable<Category[]> = readonly(_categories);
export const subcategories: Readable<Subcategory[]> = readonly(_subcategories);
export const pmLoading: Readable<boolean> = readonly(_loading);
export const pmError: Readable<string | null> = readonly(_error);

// Category methods
export async function loadCategories(): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		const result = await pmGet<PaginatedResponse<Category>>('/api/pm/categories', { limit: '500' });
		_categories.set(result.items);
	} catch (err) {
		_error.set((err as Error).message);
		_categories.set([]);
	} finally {
		_loading.set(false);
	}
}

export async function createCategory(data: {
	id: string;
	name: string;
	description?: string;
	color?: string;
}): Promise<Category> {
	_loading.set(true);
	_error.set(null);
	try {
		const category = await pmPost<Category>('/api/pm/categories', data);
		_categories.update((categories) => [...categories, category]);
		return category;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function updateCategory(
	id: string,
	data: { name?: string; description?: string; color?: string }
): Promise<Category> {
	_loading.set(true);
	_error.set(null);
	try {
		const category = await pmPatch<Category>(`/api/pm/categories/${id}`, data);
		_categories.update((categories) =>
			categories.map((c) => (c.id === id ? category : c))
		);
		return category;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function deleteCategory(id: string): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		await pmDelete(`/api/pm/categories/${id}`);
		_categories.update((categories) => categories.filter((c) => c.id !== id));
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function reorderCategories(ids: string[]): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		await pmPost('/api/pm/categories/reorder', { ids });
		// Optimistically update the order
		_categories.update((categories) => {
			const ordered = ids.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as Category[];
			return ordered;
		});
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

// Subcategory methods
export async function loadSubcategories(categoryId?: string): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		const params = categoryId ? { category_id: categoryId, limit: '500' } : { limit: '500' };
		const result = await pmGet<PaginatedResponse<Subcategory>>('/api/pm/subcategories', params);
		_subcategories.set(result.items);
	} catch (err) {
		_error.set((err as Error).message);
		_subcategories.set([]);
	} finally {
		_loading.set(false);
	}
}

export async function createSubcategory(data: {
	id: string;
	category_id: string;
	name: string;
	description?: string;
}): Promise<Subcategory> {
	_loading.set(true);
	_error.set(null);
	try {
		const subcategory = await pmPost<Subcategory>('/api/pm/subcategories', data);
		_subcategories.update((subcategories) => [...subcategories, subcategory]);
		return subcategory;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function updateSubcategory(
	id: string,
	data: { name?: string; description?: string; category_id?: string }
): Promise<Subcategory> {
	_loading.set(true);
	_error.set(null);
	try {
		const subcategory = await pmPatch<Subcategory>(`/api/pm/subcategories/${id}`, data);
		_subcategories.update((subcategories) =>
			subcategories.map((s) => (s.id === id ? subcategory : s))
		);
		return subcategory;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function deleteSubcategory(id: string): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		await pmDelete(`/api/pm/subcategories/${id}`);
		_subcategories.update((subcategories) => subcategories.filter((s) => s.id !== id));
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function reorderSubcategories(ids: string[]): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		await pmPost('/api/pm/subcategories/reorder', { ids });
		// Optimistically update the order
		_subcategories.update((subcategories) => {
			const ordered = ids.map((id) => subcategories.find((s) => s.id === id)).filter(Boolean) as Subcategory[];
			return ordered;
		});
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

export async function moveSubcategory(id: string, newCategoryId: string): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		const subcategory = await pmPost<Subcategory>(`/api/pm/subcategories/${id}/move`, {
			category_id: newCategoryId
		});
		_subcategories.update((subcategories) =>
			subcategories.map((s) => (s.id === id ? subcategory : s))
		);
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	} finally {
		_loading.set(false);
	}
}

// Helper functions
export function getCategoriesBySubcategory(subcategoryId: string): Category | undefined {
	let category: Category | undefined;
	let subcategory: Subcategory | undefined;
	
	categories.subscribe((cats) => {
		subcategories.subscribe((subs) => {
			subcategory = subs.find((s) => s.id === subcategoryId);
			if (subcategory) {
				category = cats.find((c) => c.id === subcategory!.category_id);
			}
		});
	});
	
	return category;
}

export function getSubcategoriesByCategory(categoryId: string): Subcategory[] {
	let result: Subcategory[] = [];
	subcategories.subscribe((subs) => {
		result = subs.filter((s) => s.category_id === categoryId);
	});
	return result;
}