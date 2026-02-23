import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { AgentError, AGENT_ERRORS } from './errors.js';

export interface AgentIdentityConfig {
	name: string;
	emoji?: string;
	theme?: string;
}

export interface AgentListEntry {
	id: string;
	workspace: string;
	identity?: AgentIdentityConfig;
}

function computeHash(content: string): string {
	return createHash('sha256').update(content).digest('hex');
}

export function getConfigPath(): string {
	return join(homedir(), '.openclaw', 'openclaw.json');
}

export function readConfig(): { config: Record<string, unknown>; hash: string } {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		const empty = '{}';
		return { config: {}, hash: computeHash(empty) };
	}
	const raw = readFileSync(configPath, 'utf-8');
	return { config: JSON.parse(raw), hash: computeHash(raw) };
}

export function writeConfig(config: Record<string, unknown>, expectedHash: string): string {
	const configPath = getConfigPath();

	// Re-read and verify hash for optimistic concurrency
	if (existsSync(configPath)) {
		const current = readFileSync(configPath, 'utf-8');
		const currentHash = computeHash(current);
		if (currentHash !== expectedHash) {
			throw new AgentError(
				AGENT_ERRORS.CONFLICT,
				'Config was modified externally. Please refresh and try again.'
			);
		}
	}

	const content = JSON.stringify(config, null, 2) + '\n';
	writeFileSync(configPath, content, 'utf-8');
	return computeHash(content);
}

export function getDefaultWorkspace(config: Record<string, unknown>): string {
	const agents = config?.agents as Record<string, unknown> | undefined;
	const defaults = agents?.defaults as Record<string, unknown> | undefined;
	return (defaults?.workspace as string) ?? join(homedir(), '.openclaw', 'workspace');
}

export function getAgentList(config: Record<string, unknown>): AgentListEntry[] {
	const agents = config?.agents as Record<string, unknown> | undefined;
	const list = agents?.list as AgentListEntry[] | undefined;

	if (Array.isArray(list) && list.length > 0) {
		const defaultWs = getDefaultWorkspace(config);
		return list.map((entry) => ({
			id: entry.id ?? 'main',
			workspace: entry.workspace ?? defaultWs,
			identity: entry.identity
		}));
	}

	// Synthesize a single "main" entry from defaults
	return [
		{
			id: 'main',
			workspace: getDefaultWorkspace(config)
		}
	];
}
