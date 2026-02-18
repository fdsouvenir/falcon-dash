import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { pmGet, pmPost, pmPatch, pmDelete } from './pm-api.js';

// Re-export types for UI components
export interface Domain {
	id: string;
	name: string;
	description: string | null;
	sort_order: number;
	created_at: number;
}

export interface Focus {
	id: string;
	domain_id: string;
	name: string;
	description: string | null;
	sort_order: number;
	created_at: number;
}

export interface Milestone {
	id: number;
	name: string;
	due_date: string | null;
	description: string | null;
	created_at: number;
}

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// Internal stores
const _domains: Writable<Domain[]> = writable([]);
const _focuses: Writable<Focus[]> = writable([]);
const _milestones: Writable<Milestone[]> = writable([]);
const _loading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);

// Public readonly
export const domains: Readable<Domain[]> = readonly(_domains);
export const focuses: Readable<Focus[]> = readonly(_focuses);
export const milestones: Readable<Milestone[]> = readonly(_milestones);
export const pmLoading: Readable<boolean> = readonly(_loading);
export const pmError: Readable<string | null> = readonly(_error);

// Domain methods
export async function loadDomains(): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		const result = await pmGet<PaginatedResponse<Domain>>('/api/pm/domains', { limit: '500' });
		_domains.set(result.items);
	} catch (err) {
		_error.set((err as Error).message);
		_domains.set([]);
	} finally {
		_loading.set(false);
	}
}

export async function getDomain(id: string): Promise<Domain> {
	_error.set(null);
	try {
		return await pmGet<Domain>(`/api/pm/domains/${id}`);
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function createDomain(data: {
	id: string;
	name: string;
	description?: string;
}): Promise<Domain> {
	_error.set(null);
	try {
		const domain = await pmPost<Domain>('/api/pm/domains', data);
		await loadDomains();
		return domain;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function updateDomain(
	id: string,
	data: { name?: string; description?: string }
): Promise<Domain> {
	_error.set(null);
	try {
		const domain = await pmPatch<Domain>(`/api/pm/domains/${id}`, data);
		await loadDomains();
		return domain;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function deleteDomain(id: string): Promise<void> {
	_error.set(null);
	try {
		await pmDelete(`/api/pm/domains/${id}`);
		await loadDomains();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function reorderDomains(ids: string[]): Promise<void> {
	_error.set(null);
	try {
		await pmPost('/api/pm/domains/reorder', { ids });
		await loadDomains();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

// Focus methods
export async function loadFocuses(domainId?: string): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		const params: Record<string, string> = { limit: '500' };
		if (domainId) params.domain_id = domainId;
		const result = await pmGet<PaginatedResponse<Focus>>('/api/pm/focuses', params);
		_focuses.set(result.items);
	} catch (err) {
		_error.set((err as Error).message);
		_focuses.set([]);
	} finally {
		_loading.set(false);
	}
}

export async function getFocus(id: string): Promise<Focus> {
	_error.set(null);
	try {
		return await pmGet<Focus>(`/api/pm/focuses/${id}`);
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function createFocus(data: {
	id: string;
	domain_id: string;
	name: string;
	description?: string;
}): Promise<Focus> {
	_error.set(null);
	try {
		const focus = await pmPost<Focus>('/api/pm/focuses', data);
		await loadFocuses();
		return focus;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function updateFocus(
	id: string,
	data: { name?: string; description?: string }
): Promise<Focus> {
	_error.set(null);
	try {
		const focus = await pmPatch<Focus>(`/api/pm/focuses/${id}`, data);
		await loadFocuses();
		return focus;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function moveFocus(id: string, newDomainId: string): Promise<Focus> {
	_error.set(null);
	try {
		const focus = await pmPost<Focus>(`/api/pm/focuses/${id}/move`, {
			domain_id: newDomainId
		});
		await loadFocuses();
		return focus;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function deleteFocus(id: string): Promise<void> {
	_error.set(null);
	try {
		await pmDelete(`/api/pm/focuses/${id}`);
		await loadFocuses();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function reorderFocuses(ids: string[]): Promise<void> {
	_error.set(null);
	try {
		await pmPost('/api/pm/focuses/reorder', { ids });
		await loadFocuses();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

// Milestone methods
export async function loadMilestones(): Promise<void> {
	_loading.set(true);
	_error.set(null);
	try {
		const result = await pmGet<PaginatedResponse<Milestone>>('/api/pm/milestones', {
			limit: '500'
		});
		_milestones.set(result.items);
	} catch (err) {
		_error.set((err as Error).message);
		_milestones.set([]);
	} finally {
		_loading.set(false);
	}
}

export async function getMilestone(id: number): Promise<Milestone> {
	_error.set(null);
	try {
		return await pmGet<Milestone>(`/api/pm/milestones/${id}`);
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function createMilestone(data: {
	name: string;
	due_date?: string;
	description?: string;
}): Promise<Milestone> {
	_error.set(null);
	try {
		const milestone = await pmPost<Milestone>('/api/pm/milestones', data);
		await loadMilestones();
		return milestone;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function updateMilestone(
	id: number,
	data: { name?: string; due_date?: string; description?: string }
): Promise<Milestone> {
	_error.set(null);
	try {
		const milestone = await pmPatch<Milestone>(`/api/pm/milestones/${id}`, data);
		await loadMilestones();
		return milestone;
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function deleteMilestone(id: number): Promise<void> {
	_error.set(null);
	try {
		await pmDelete(`/api/pm/milestones/${id}`);
		await loadMilestones();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}
