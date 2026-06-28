import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { rpc, gatewayEvents } from '$lib/gateway-api.js';

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
// Agent the heartbeat config/template operations target. Resolved from the
// gateway `status.heartbeat.defaultAgentId` on load; defaults to 'main'.
let heartbeatAgentId = 'main';

const HEARTBEAT_TEMPLATE_FILE = 'HEARTBEAT.md';

/** Subset of the gateway v4 `status.heartbeat` payload we consume. */
interface StatusHeartbeatAgent {
	agentId: string;
	enabled: boolean;
	every: string;
	everyMs: number;
}
interface StatusPayload {
	heartbeat?: { defaultAgentId?: string; agents?: StatusHeartbeatAgent[] };
}

/**
 * Derive runtime status from the heartbeat config. Gateway protocol v4 removed
 * the dedicated `heartbeat.status` RPC, so the schedule status is computed from
 * the config's enabled/interval/lastRun fields instead.
 */
function deriveStatus(config: HeartbeatConfig | null): HeartbeatStatus | null {
	if (!config) return null;
	const intervalMs = config.intervalMinutes * 60_000;
	return {
		active: config.enabled,
		paused: !config.enabled,
		lastRun: config.lastRun,
		nextRun: config.enabled && config.lastRun ? config.lastRun + intervalMs : null,
		intervalMs
	};
}

export async function loadHeartbeatConfig(): Promise<void> {
	_isLoading.set(true);
	_error.set(null);
	// Gateway protocol v4: heartbeat enabled/interval come from the `status`
	// payload (per-agent), the template lives in the agent workspace file, and
	// the last run comes from `last-heartbeat`. These are independent so one
	// failing RPC doesn't blank the others.
	const [statusResult, lastRunResult] = await Promise.allSettled([
		rpc<StatusPayload>('status', {}),
		rpc<{ executions?: HeartbeatExecution[] }>('last-heartbeat', {})
	]);

	let lastRun: number | null = null;
	if (lastRunResult.status === 'fulfilled') {
		lastRun = lastRunResult.value.executions?.[0]?.timestamp ?? null;
	}

	if (statusResult.status === 'fulfilled') {
		const hb = statusResult.value.heartbeat;
		heartbeatAgentId = hb?.defaultAgentId ?? heartbeatAgentId;
		const agent =
			hb?.agents?.find((a) => a.agentId === heartbeatAgentId) ?? hb?.agents?.[0] ?? null;
		const prev = currentConfig();
		const config: HeartbeatConfig | null = agent
			? {
					enabled: agent.enabled,
					intervalMinutes: Math.round(agent.everyMs / 60_000),
					lastRun,
					// activeHours/deliveryTarget are not exposed by v4 core status;
					// preserve any previously loaded values or fall back to defaults.
					activeHours: prev?.activeHours ?? { start: '00:00', end: '23:59', timezone: 'UTC' },
					deliveryTarget: prev?.deliveryTarget ?? 'last'
				}
			: null;
		_config.set(config);
		_status.set(deriveStatus(config));
	} else {
		_error.set((statusResult.reason as Error).message);
	}

	// Load the template now that heartbeatAgentId is resolved.
	try {
		const fileResult = await rpc<{ file?: { content?: string } }>('agents.files.get', {
			agentId: heartbeatAgentId,
			name: HEARTBEAT_TEMPLATE_FILE
		});
		_template.set(fileResult.file?.content ?? '');
	} catch (err) {
		_error.set((err as Error).message);
	}

	_isLoading.set(false);
}

let _configValue: HeartbeatConfig | null = null;
_config.subscribe((v) => (_configValue = v));
function currentConfig(): HeartbeatConfig | null {
	return _configValue;
}

export async function updateHeartbeatConfig(patch: Partial<HeartbeatConfig>): Promise<boolean> {
	try {
		// Gateway protocol v4 only exposes enable/disable via `set-heartbeats`.
		if (patch.enabled !== undefined) {
			await rpc('set-heartbeats', { enabled: patch.enabled });
		}
		// Interval/activeHours/deliveryTarget are gateway config (or falcon-dash
		// plugin) settings with no granular v4 RPC; surface that rather than
		// silently dropping them.
		const unsupported = (['intervalMinutes', 'activeHours', 'deliveryTarget'] as const).filter(
			(k) => patch[k] !== undefined
		);
		if (unsupported.length > 0) {
			_error.set(
				`Editing ${unsupported.join(', ')} is not supported by gateway protocol v4 core; configure it in the gateway config.`
			);
			await loadHeartbeatConfig();
			return false;
		}
		await loadHeartbeatConfig();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function saveHeartbeatTemplate(content: string): Promise<boolean> {
	try {
		await rpc('agents.files.set', {
			agentId: heartbeatAgentId,
			name: HEARTBEAT_TEMPLATE_FILE,
			content
		});
		_template.set(content);
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export function subscribeToHeartbeatEvents(): void {
	if (eventUnsub) return;
	eventUnsub = gatewayEvents.on('heartbeat', () => {
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
		const result = await rpc<{ executions: HeartbeatExecution[] }>('last-heartbeat', {});
		_executions.set(result.executions ?? []);
	} catch (err) {
		_error.set((err as Error).message);
		_executions.set([]);
	} finally {
		_executionsLoading.set(false);
	}
}
