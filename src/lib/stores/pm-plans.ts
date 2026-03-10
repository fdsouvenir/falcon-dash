import { writable, readonly, get, type Readable, type Writable } from 'svelte/store';
import { pmGet, pmPost, pmPatch, pmDelete } from './pm-api.js';

export interface Plan {
	id: number;
	project_id: number;
	title: string;
	description: string | null;
	result: string | null;
	status: string;
	sort_order: number;
	version: number;
	created_by: string;
	created_at: number;
	updated_at: number;
}

export interface PlanVersion {
	id: number;
	plan_id: number;
	version: number;
	description: string | null;
	result: string | null;
	status: string;
	created_by: string;
	created_at: number;
}

interface PaginatedResponse<T> {
	items: T[];
	total: number;
}

// Internal stores
const _plans: Writable<Plan[]> = writable([]);
const _currentPlan: Writable<Plan | null> = writable(null);
const _planVersions: Writable<PlanVersion[]> = writable([]);
const _plansLoading: Writable<boolean> = writable(false);

// Public readonly
export const plans: Readable<Plan[]> = readonly(_plans);
export const currentPlan: Readable<Plan | null> = readonly(_currentPlan);
export const planVersions: Readable<PlanVersion[]> = readonly(_planVersions);
export const plansLoading: Readable<boolean> = readonly(_plansLoading);

// Clear plans store
export function clearPlans(): void {
	_plans.set([]);
	_currentPlan.set(null);
}

// Plan methods
export async function loadPlans(projectId: number): Promise<void> {
	// Clear existing plans first to avoid showing stale data
	clearPlans();
	_plansLoading.set(true);
	try {
		const res = await pmGet<PaginatedResponse<Plan>>('/api/pm/plans', { project_id: projectId.toString() });
		_plans.set(res.items);
	} finally {
		_plansLoading.set(false);
	}
}

export async function getPlan(id: number): Promise<Plan> {
	const plan = await pmGet<Plan>(`/api/pm/plans/${id}`);
	_currentPlan.set(plan);
	return plan;
}

export async function createPlan(data: {
	project_id: number;
	title: string;
	description?: string;
	result?: string;
	status?: string;
}): Promise<Plan> {
	_plansLoading.set(true);
	try {
		const plan = await pmPost<Plan>('/api/pm/plans', data);
		_plans.update((plans) => [...plans, plan]);
		return plan;
	} finally {
		_plansLoading.set(false);
	}
}

export async function updatePlan(
	id: number,
	data: {
		title?: string;
		description?: string;
		result?: string;
		status?: string;
	}
): Promise<Plan> {
	_plansLoading.set(true);
	try {
		const plan = await pmPatch<Plan>(`/api/pm/plans/${id}`, data);
		_currentPlan.set(plan);
		_plans.update((plans) => plans.map((p) => (p.id === id ? plan : p)));
		return plan;
	} finally {
		_plansLoading.set(false);
	}
}

export async function deletePlan(id: number): Promise<void> {
	_plansLoading.set(true);
	try {
		await pmDelete(`/api/pm/plans/${id}`);
		const currentValue = get(_currentPlan);
		if (currentValue?.id === id) {
			_currentPlan.set(null);
		}
		_plans.update((plans) => plans.filter((p) => p.id !== id));
	} finally {
		_plansLoading.set(false);
	}
}

export async function reorderPlans(ids: number[]): Promise<void> {
	_plansLoading.set(true);
	try {
		await pmPost('/api/pm/plans/reorder', { ids });
		// Optimistically update the order
		_plans.update((plans) => {
			const ordered = ids.map((id) => plans.find((p) => p.id === id)).filter(Boolean) as Plan[];
			return ordered;
		});
	} finally {
		_plansLoading.set(false);
	}
}

// Plan version methods
export async function loadPlanVersions(planId: number): Promise<void> {
	_plansLoading.set(true);
	try {
		const res = await pmGet<PaginatedResponse<PlanVersion>>(`/api/pm/plans/${planId}/versions`);
		_planVersions.set(res.items);
	} finally {
		_plansLoading.set(false);
	}
}

export async function revertPlanVersion(planId: number, version: number): Promise<Plan> {
	_plansLoading.set(true);
	try {
		const plan = await pmPost<Plan>(`/api/pm/plans/${planId}/revert`, { version });
		_currentPlan.set(plan);
		_plans.update((plans) => plans.map((p) => (p.id === planId ? plan : p)));
		return plan;
	} finally {
		_plansLoading.set(false);
	}
}

// Helper functions
export const PLAN_STATUSES = [
	'planning',
	'assigned',
	'in_progress',
	'needs_review',
	'complete',
	'cancelled'
] as const;

export type PlanStatus = typeof PLAN_STATUSES[number];

export function getPlansByProject(projectId: number): Plan[] {
	const currentPlans = get(plans);
	return currentPlans.filter((p) => p.project_id === projectId);
}

// Cross-project plans (Plan 7)
export interface CrossProjectPlan extends Plan {
	project_title: string;
}

export async function loadCrossProjectPlans(status?: string): Promise<CrossProjectPlan[]> {
	const params: Record<string, string> = {};
	if (status) params.status = status;
	const res = await pmGet<{ items: CrossProjectPlan[]; total: number }>('/api/pm/plans', params);
	return res.items;
}