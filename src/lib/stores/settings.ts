import { writable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import type { GatewayConfigResponse } from '$lib/gateway/types';
import type {
	ConfigSchema,
	ConfigSnapshot,
	ConfigPatchParams,
	ConfigApplyParams,
	SkillEntry,
	SkillStatusResponse,
	NodeEntry,
	NodeListResponse,
	NodeDescribeResponse,
	DeviceEntry,
	DeviceListResponse,
	LogEntry,
	LogTailParams,
	LogTailResponse,
	ExecAllowlistEntry
} from '$lib/types/settings';

// --- Config Stores ---

export const configSnapshot = writable<ConfigSnapshot>({ payload: {}, hash: '' });
export const configSchema = writable<ConfigSchema>({ properties: {} });

export async function loadConfig(key?: string): Promise<void> {
	const params = key ? { key } : undefined;
	const response = await gateway.call<GatewayConfigResponse>('config.get', params);
	configSnapshot.set({ payload: response.payload, hash: response.hash });
}

export async function patchConfig(params: ConfigPatchParams): Promise<void> {
	await gateway.call('config.patch', params as unknown as Record<string, unknown>);
	await loadConfig();
}

export async function applyConfig(params: ConfigApplyParams): Promise<void> {
	await gateway.call('config.apply', params as unknown as Record<string, unknown>);
	await loadConfig();
}

export async function loadSchema(): Promise<void> {
	const response = await gateway.call<ConfigSchema>('config.schema');
	configSchema.set(response);
}

// --- Skills Stores ---

export const skills = writable<SkillEntry[]>([]);

export async function loadSkills(): Promise<void> {
	const response = await gateway.call<SkillStatusResponse>('skills.status');
	skills.set(response.skills);
}

export async function enableSkill(skillId: string): Promise<void> {
	skills.update((list) => list.map((s) => (s.id === skillId ? { ...s, enabled: true } : s)));
	try {
		await gateway.call('skills.enable', { skillId });
	} catch (err) {
		skills.update((list) => list.map((s) => (s.id === skillId ? { ...s, enabled: false } : s)));
		throw err;
	}
}

export async function disableSkill(skillId: string): Promise<void> {
	skills.update((list) => list.map((s) => (s.id === skillId ? { ...s, enabled: false } : s)));
	try {
		await gateway.call('skills.disable', { skillId });
	} catch (err) {
		skills.update((list) => list.map((s) => (s.id === skillId ? { ...s, enabled: true } : s)));
		throw err;
	}
}

// --- Nodes Stores ---

export const nodes = writable<NodeEntry[]>([]);

export async function loadNodes(): Promise<void> {
	const response = await gateway.call<NodeListResponse>('nodes.list');
	nodes.set(response.nodes);
}

export async function describeNode(nodeId: string): Promise<NodeEntry> {
	const response = await gateway.call<NodeDescribeResponse>('nodes.describe', { nodeId });
	return response.node;
}

// --- Devices Stores ---

export const devices = writable<DeviceEntry[]>([]);

export async function loadDevices(): Promise<void> {
	const response = await gateway.call<DeviceListResponse>('devices.list');
	devices.set(response.devices);
}

export async function approveDevice(deviceId: string): Promise<void> {
	await gateway.call('devices.approve', { deviceId });
	devices.update((list) =>
		list.map((d) => (d.id === deviceId ? { ...d, status: 'approved' as const } : d))
	);
}

export async function rejectDevice(deviceId: string): Promise<void> {
	await gateway.call('devices.reject', { deviceId });
	devices.update((list) =>
		list.map((d) => (d.id === deviceId ? { ...d, status: 'rejected' as const } : d))
	);
}

export async function revokeDevice(deviceId: string): Promise<void> {
	await gateway.call('devices.revoke', { deviceId });
	devices.update((list) =>
		list.map((d) => (d.id === deviceId ? { ...d, status: 'revoked' as const } : d))
	);
}

// --- Logs Stores ---

export const logEntries = writable<LogEntry[]>([]);
export const logCursor = writable<string>('');

const MAX_LOG_ENTRIES = 1000;

export async function tailLogs(params?: LogTailParams): Promise<void> {
	const response = await gateway.call<LogTailResponse>(
		'logs.tail',
		params as unknown as Record<string, unknown>
	);
	logCursor.set(response.cursor);
	logEntries.update((existing) => {
		const combined = [...existing, ...response.entries];
		if (combined.length > MAX_LOG_ENTRIES) {
			return combined.slice(combined.length - MAX_LOG_ENTRIES);
		}
		return combined;
	});
}

export function clearLogs(): void {
	logEntries.set([]);
	logCursor.set('');
}

// --- Exec Allowlist Stores ---

export const execAllowlist = writable<ExecAllowlistEntry[]>([]);

export async function loadExecAllowlist(): Promise<void> {
	const response = await gateway.call<GatewayConfigResponse>('config.get', {
		key: 'security.exec.allowlist'
	});
	execAllowlist.set(response.payload as unknown as ExecAllowlistEntry[]);
}

export async function addExecAllowlistEntry(pattern: string, description?: string): Promise<void> {
	const entry: ExecAllowlistEntry = {
		pattern,
		description,
		addedAt: Date.now()
	};
	execAllowlist.update((list) => [...list, entry]);
	try {
		await gateway.call('config.patch', {
			key: 'security.exec.allowlist',
			action: 'add',
			entry: entry as unknown as Record<string, unknown>
		});
	} catch (err) {
		execAllowlist.update((list) => list.filter((e) => e.pattern !== pattern));
		throw err;
	}
}

export async function removeExecAllowlistEntry(pattern: string): Promise<void> {
	let prev: ExecAllowlistEntry[] = [];
	execAllowlist.update((list) => {
		prev = list;
		return list.filter((e) => e.pattern !== pattern);
	});
	try {
		await gateway.call('config.patch', {
			key: 'security.exec.allowlist',
			action: 'remove',
			pattern
		});
	} catch (err) {
		execAllowlist.set(prev);
		throw err;
	}
}

// --- Event Listeners ---

let unsubscribeFns: (() => void)[] = [];

function handleDeviceEvent(payload: unknown): void {
	const event = payload as Record<string, unknown>;
	const action = event.action as string;

	if (action === 'pair_requested') {
		const device = event.device as DeviceEntry;
		devices.update((list) => {
			const idx = list.findIndex((d) => d.id === device.id);
			if (idx >= 0) {
				const updated = [...list];
				updated[idx] = device;
				return updated;
			}
			return [...list, device];
		});
	} else if (action === 'pair_resolved') {
		const device = event.device as DeviceEntry;
		devices.update((list) => list.map((d) => (d.id === device.id ? device : d)));
	}
}

function handleConfigEvent(payload: unknown): void {
	const event = payload as Record<string, unknown>;
	if (event.snapshot) {
		const snapshot = event.snapshot as ConfigSnapshot;
		configSnapshot.set(snapshot);
	}
}

export function initSettingsListeners(): void {
	destroySettingsListeners();
	unsubscribeFns.push(gateway.on('device', handleDeviceEvent));
	unsubscribeFns.push(gateway.on('config', handleConfigEvent));
}

export function destroySettingsListeners(): void {
	unsubscribeFns.forEach((fn) => fn());
	unsubscribeFns = [];
}
