import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { call, eventBus } from '$lib/stores/gateway.js';

export interface HeartbeatConfig {
	enabled: boolean;
	intervalMinutes: number;
	lastRun: number | null;
	activeHours: {
		start: string; // "HH:MM"
		end: string; // "HH:MM"
		timezone: string;
	};
	deliveryTarget: 'last' | 'none' | string; // 'last', 'none', or channel name
}

export interface HeartbeatStatus {
	active: boolean;
	paused: boolean;
	nextRun: number | null;
	lastRun: number | null;
	intervalMs: number;
}

const _config: Writable<HeartbeatConfig | null> = writable(null);
const _status: Writable<HeartbeatStatus | null> = writable(null);
const _template: Writable<string> = writable('');
const _isLoading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);

export const heartbeatConfig: Readable<HeartbeatConfig | null> = readonly(_config);
export const heartbeatStatus: Readable<HeartbeatStatus | null> = readonly(_status);
export const heartbeatTemplate: Readable<string> = readonly(_template);
export const heartbeatLoading: Readable<boolean> = readonly(_isLoading);
export const heartbeatError: Readable<string | null> = readonly(_error);

let eventUnsub: (() => void) | null = null;

export async function loadHeartbeatConfig(): Promise<void> {
	_isLoading.set(true);
	_error.set(null);
	try {
		const [configResult, statusResult, templateResult] = await Promise.all([
			call<{ heartbeat: HeartbeatConfig }>('config.get', { path: 'heartbeat' }),
			call<HeartbeatStatus>('heartbeat.status', {}),
			call<{ content: string }>('agents-files.get', { path: 'HEARTBEAT.md' })
		]);
		_config.set(configResult.heartbeat ?? null);
		_status.set(statusResult ?? null);
		_template.set(templateResult.content ?? '');
	} catch (err) {
		_error.set((err as Error).message);
	} finally {
		_isLoading.set(false);
	}
}

export async function updateHeartbeatConfig(patch: Partial<HeartbeatConfig>): Promise<boolean> {
	try {
		await call('config.patch', { path: 'heartbeat', value: patch });
		await loadHeartbeatConfig();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function saveHeartbeatTemplate(content: string): Promise<boolean> {
	try {
		await call('agents-files.set', { path: 'HEARTBEAT.md', content });
		_template.set(content);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export function subscribeToHeartbeatEvents(): void {
	if (eventUnsub) return;
	eventUnsub = eventBus.on('heartbeat', () => {
		loadHeartbeatConfig();
	});
}

export function unsubscribeFromHeartbeatEvents(): void {
	if (eventUnsub) {
		eventUnsub();
		eventUnsub = null;
	}
}

export interface HeartbeatExecution {
	id: string;
	timestamp: number;
	checked: string[];
	surfaced: string[];
	summary: string;
	status: 'success' | 'error';
}

const _executions: Writable<HeartbeatExecution[]> = writable([]);
const _executionsLoading: Writable<boolean> = writable(false);

export const heartbeatExecutions: Readable<HeartbeatExecution[]> = readonly(_executions);
export const heartbeatExecutionsLoading: Readable<boolean> = readonly(_executionsLoading);

export async function loadHeartbeatHistory(): Promise<void> {
	_executionsLoading.set(true);
	try {
		const result = await call<{ executions: HeartbeatExecution[] }>('last-heartbeat', {});
		_executions.set(result.executions ?? []);
	} catch (err) {
		_error.set((err as Error).message);
		_executions.set([]);
	} finally {
		_executionsLoading.set(false);
	}
}
