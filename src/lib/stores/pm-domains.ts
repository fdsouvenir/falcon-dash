import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { call, eventBus } from '$lib/stores/gateway.js';

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
		const result = await call<{ domains: Domain[] }>('pm.domain.list');
		_domains.set(result.domains ?? []);
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
		return await call<Domain>('pm.domain.get', { id });
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
		const domain = await call<Domain>('pm.domain.create', data as Record<string, unknown>);
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
		const domain = await call<Domain>('pm.domain.update', { id, ...data });
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
		await call('pm.domain.delete', { id });
		await loadDomains();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function reorderDomains(ids: string[]): Promise<void> {
	_error.set(null);
	try {
		await call('pm.domain.reorder', { ids });
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
		const params = domainId ? { domainId } : undefined;
		const result = await call<{ focuses: Focus[] }>('pm.focus.list', params);
		_focuses.set(result.focuses ?? []);
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
		return await call<Focus>('pm.focus.get', { id });
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
		const focus = await call<Focus>('pm.focus.create', data as Record<string, unknown>);
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
		const focus = await call<Focus>('pm.focus.update', { id, ...data });
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
		const focus = await call<Focus>('pm.focus.move', { id, domainId: newDomainId });
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
		await call('pm.focus.delete', { id });
		await loadFocuses();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

export async function reorderFocuses(ids: string[]): Promise<void> {
	_error.set(null);
	try {
		await call('pm.focus.reorder', { ids });
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
		const result = await call<{ milestones: Milestone[] }>('pm.milestone.list');
		_milestones.set(result.milestones ?? []);
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
		return await call<Milestone>('pm.milestone.get', { id });
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
		const milestone = await call<Milestone>('pm.milestone.create', data as Record<string, unknown>);
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
		const milestone = await call<Milestone>('pm.milestone.update', { id, ...data });
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
		await call('pm.milestone.delete', { id });
		await loadMilestones();
	} catch (err) {
		_error.set((err as Error).message);
		throw err;
	}
}

// Event subscriptions
let eventUnsub: (() => void) | null = null;

export function subscribeToPMEvents(): void {
	if (eventUnsub) return;

	const unsubs: Array<() => void> = [];

	unsubs.push(
		eventBus.on('pm.domain.changed', () => {
			loadDomains();
		})
	);

	unsubs.push(
		eventBus.on('pm.focus.changed', () => {
			loadFocuses();
		})
	);

	unsubs.push(
		eventBus.on('pm.milestone.changed', () => {
			loadMilestones();
		})
	);

	eventUnsub = () => {
		unsubs.forEach((u) => u());
		eventUnsub = null;
	};
}

export function unsubscribeFromPMEvents(): void {
	if (eventUnsub) {
		eventUnsub();
		eventUnsub = null;
	}
}
