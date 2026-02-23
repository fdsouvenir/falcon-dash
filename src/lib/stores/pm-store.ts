import { writable, derived, readonly, type Readable, type Writable } from 'svelte/store';
import { pmGet } from './pm-api.js';
import type { Project } from './pm-projects.js';
import type { Domain, Focus } from './pm-domains.js';

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
const _domainCache: Writable<Map<string, Domain>> = writable(new Map());
const _focusCache: Writable<Map<string, Focus>> = writable(new Map());
const _projectCache: Writable<Map<number, Project>> = writable(new Map());

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// Hydrate all caches
export async function hydratePMStores(): Promise<void> {
	try {
		const [domainsRes, focusesRes, projectsRes] = await Promise.all([
			pmGet<PaginatedResponse<Domain>>('/api/pm/domains', { limit: '500' }),
			pmGet<PaginatedResponse<Focus>>('/api/pm/focuses', { limit: '500' }),
			pmGet<PaginatedResponse<Project>>('/api/pm/projects', { limit: '500' })
		]);

		const domainMap = new Map<string, Domain>();
		for (const d of domainsRes.items) domainMap.set(d.id, d);
		_domainCache.set(domainMap);

		const focusMap = new Map<string, Focus>();
		for (const f of focusesRes.items) focusMap.set(f.id, f);
		_focusCache.set(focusMap);

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
