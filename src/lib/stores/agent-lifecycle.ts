import { writable, derived } from 'svelte/store';
import { call } from '$lib/stores/gateway.js';

export interface ActiveAgent {
	runId: string;
	task?: string;
	model?: string;
	tokens?: number;
	cost?: number;
	startedAt?: string;
}

export interface AgentHistory {
	runId: string;
	task?: string;
	model?: string;
	tokens?: number;
	cost?: number;
	startedAt?: string;
	endedAt?: string;
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
		const result = await call<{ active?: ActiveAgent[]; history?: AgentHistory[] }>(
			'agents.list',
			{}
		);
		_state.set({
			active: result.active ?? [],
			history: result.history ?? [],
			loading: false,
			error: null
		});
	} catch (err) {
		_state.update((s) => ({ ...s, loading: false, error: String(err) }));
	}
}

export async function stopAgent(runId: string): Promise<void> {
	await call('agents.stop', { runId });
	await loadAgentLifecycle();
}

export async function restartGateway(): Promise<void> {
	await call('update.run', {});
}
