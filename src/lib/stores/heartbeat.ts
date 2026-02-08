import { writable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import type { HeartbeatConfig, GatewayConfigResponse } from '$lib/gateway/types';

export const heartbeatConfig = writable<HeartbeatConfig>({
	enabled: false,
	intervalMinutes: 30
});
export const heartbeatFileContent = writable<string>('');
export const heartbeatFileHash = writable<string>('');

export async function loadHeartbeatConfig(): Promise<void> {
	const response = await gateway.call<GatewayConfigResponse>('config.get', {
		key: 'agents.defaults.heartbeat'
	});
	heartbeatConfig.set(response.payload as unknown as HeartbeatConfig);
}

export async function updateHeartbeatConfig(patch: Partial<HeartbeatConfig>): Promise<void> {
	await gateway.call('config.patch', {
		key: 'agents.defaults.heartbeat',
		...(patch as unknown as Record<string, unknown>)
	});
	heartbeatConfig.update((current) => ({ ...current, ...patch }));
}

export async function loadHeartbeatFile(): Promise<void> {
	const res = await fetch('/api/workspace/files/HEARTBEAT.md');
	if (!res.ok) {
		if (res.status === 404) {
			heartbeatFileContent.set('');
			heartbeatFileHash.set('');
			return;
		}
		throw new Error(res.statusText);
	}
	const data = await res.json();
	heartbeatFileContent.set(data.content);
	heartbeatFileHash.set(data.hash);
}

export async function saveHeartbeatFile(
	content: string,
	baseHash: string
): Promise<{ hash: string; ok: boolean }> {
	const res = await fetch('/api/workspace/files/HEARTBEAT.md', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content, baseHash })
	});
	if (res.status === 409) {
		throw new Error('HEARTBEAT.md was modified by another process. Please reload and try again.');
	}
	if (!res.ok) {
		throw new Error(res.statusText);
	}
	const data = await res.json();
	heartbeatFileContent.set(content);
	heartbeatFileHash.set(data.hash);
	return data;
}
