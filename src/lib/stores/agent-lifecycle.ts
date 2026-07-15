import { writable, derived } from 'svelte/store';
import { rpc } from '$lib/gateway-api.js';

export interface ActiveAgent {
	taskId: string;
	runId?: string;
	sessionKey?: string;
	task?: string;
	model?: string;
	tokens?: number;
	cost?: number;
	startedAt?: string;
}

export interface AgentHistory {
	taskId: string;
	runId?: string;
	sessionKey?: string;
	task?: string;
	model?: string;
	tokens?: number;
	cost?: number;
	startedAt?: string;
	endedAt?: string;
}

/** Subset of the gateway v4 TaskSummary we consume (tasks.list). */
interface TaskSummary {
	id: string;
	status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
	title?: string;
	runtime?: string;
	agentId?: string;
	sessionKey?: string;
	runId?: string;
	createdAt?: string | number;
	startedAt?: string | number;
	endedAt?: string | number;
}

const ACTIVE_STATUSES = new Set(['queued', 'running']);

export function asTimestamp(value: string | number | undefined): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value === 'string') return value;
	const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
	const date = new Date(milliseconds);
	return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export interface AgentLifecycleState {
	active: ActiveAgent[];
	history: AgentHistory[];
	loading: boolean;
	error: string | null;
}

const _state = writable<AgentLifecycleState>({
	active: [],
	history: [],
	loading: false,
	error: null
});

export const agentLifecycle = {
	subscribe: _state.subscribe,
	active: derived(_state, (s) => s.active),
	history: derived(_state, (s) => s.history),
	loading: derived(_state, (s) => s.loading),
	error: derived(_state, (s) => s.error)
};

export async function loadAgentLifecycle(): Promise<void> {
	_state.update((s) => ({ ...s, loading: true, error: null }));
	try {
		// Gateway v4: agent runs live in the task ledger. `agents.list` only
		// returns configured agents, so active/recent runs come from tasks.list.
		const result = await rpc<{ tasks?: TaskSummary[] }>('tasks.list', {});
		const tasks = result.tasks ?? [];
		const active: ActiveAgent[] = [];
		const history: AgentHistory[] = [];
		for (const t of tasks) {
			const base = {
				taskId: t.id,
				runId: t.runId,
				sessionKey: t.sessionKey,
				task: t.title,
				model: t.runtime,
				startedAt: asTimestamp(t.startedAt ?? t.createdAt)
			};
			if (ACTIVE_STATUSES.has(t.status)) {
				active.push(base);
			} else {
				history.push({ ...base, endedAt: asTimestamp(t.endedAt) });
			}
		}
		_state.set({ active, history, loading: false, error: null });
	} catch (err) {
		_state.update((s) => ({ ...s, loading: false, error: String(err) }));
	}
}

export async function stopAgent(taskId: string): Promise<void> {
	await rpc('tasks.cancel', { taskId });
	await loadAgentLifecycle();
}

export async function restartGateway(): Promise<void> {
	await rpc('update.run', {});
}
