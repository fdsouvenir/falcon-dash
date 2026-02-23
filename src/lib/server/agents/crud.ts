import { join } from 'path';
import { homedir } from 'os';
import {
	readConfig,
	writeConfig,
	getAgentList,
	getDefaultWorkspace,
	type AgentListEntry,
	type AgentIdentityConfig
} from './config.js';
import { AgentError, AGENT_ERRORS } from './errors.js';
import { createWorkspace, triggerSyncPeers } from './sync.js';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;
const RESERVED_IDS = new Set(['default']);
const AUTO_ID_PATTERN = /^agent-(\d{3})$/;

function validateId(id: string): void {
	if (!ID_PATTERN.test(id)) {
		throw new AgentError(
			AGENT_ERRORS.INVALID,
			'Agent ID must be 2-32 characters, lowercase alphanumeric and hyphens, cannot start or end with a hyphen.'
		);
	}
	if (RESERVED_IDS.has(id)) {
		throw new AgentError(AGENT_ERRORS.INVALID, `"${id}" is a reserved agent ID.`);
	}
}

function ensureAgentsList(config: Record<string, unknown>): AgentListEntry[] {
	if (!config.agents) {
		config.agents = {};
	}
	const agents = config.agents as Record<string, unknown>;
	if (!Array.isArray(agents.list)) {
		// Bootstrap from defaults — create the list with the existing main agent
		const defaultWs = getDefaultWorkspace(config);
		agents.list = [{ id: 'main', workspace: defaultWs }];
	}
	return agents.list as AgentListEntry[];
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
	const keys = path.split('.');
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
			current[keys[i]] = {};
		}
		current = current[keys[i]] as Record<string, unknown>;
	}
	current[keys[keys.length - 1]] = value;
}

function nextAgentId(list: AgentListEntry[]): string {
	const nums = list
		.map((a) => AUTO_ID_PATTERN.exec(a.id))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => parseInt(m[1], 10));
	const next = Math.max(0, ...nums) + 1;
	return `agent-${String(next).padStart(3, '0')}`;
}

export function listAgents(): { agents: AgentListEntry[]; hash: string } {
	const { config, hash } = readConfig();
	return { agents: getAgentList(config), hash };
}

export function getAgent(id: string): AgentListEntry | null {
	const { config } = readConfig();
	return getAgentList(config).find((a) => a.id === id) ?? null;
}

export async function createAgent(
	params: { id?: string; identity?: AgentIdentityConfig } | undefined,
	expectedHash: string
): Promise<{ agent: AgentListEntry; hash: string; syncTriggered: boolean }> {
	const { config, hash } = readConfig();
	if (hash !== expectedHash) {
		throw new AgentError(
			AGENT_ERRORS.CONFLICT,
			'Config was modified externally. Please refresh and try again.'
		);
	}

	const list = ensureAgentsList(config);

	const id = params?.id ?? nextAgentId(list);
	validateId(id);

	if (list.some((a) => a.id === id)) {
		throw new AgentError(AGENT_ERRORS.DUPLICATE, `Agent "${id}" already exists.`);
	}

	const workspace = join(homedir(), '.openclaw', `workspace-${id}`);
	const agent: AgentListEntry = {
		id,
		workspace,
		...(params?.identity ? { identity: params.identity } : {})
	};

	list.push(agent);

	// Enable agent-to-agent communication if 2+ agents
	if (list.length >= 2) {
		setNestedValue(config, 'tools.agentToAgent.enabled', true);
	}

	const newHash = writeConfig(config, hash);

	// Workspace setup
	await createWorkspace(workspace);

	const syncTriggered = await triggerSyncPeers();

	return { agent, hash: newHash, syncTriggered };
}

export async function updateAgent(
	id: string,
	updates: { identity?: Partial<AgentIdentityConfig> },
	expectedHash: string
): Promise<{ agent: AgentListEntry; hash: string; syncTriggered: boolean }> {
	const { config, hash } = readConfig();
	if (hash !== expectedHash) {
		throw new AgentError(
			AGENT_ERRORS.CONFLICT,
			'Config was modified externally. Please refresh and try again.'
		);
	}

	const list = ensureAgentsList(config);
	const idx = list.findIndex((a) => a.id === id);
	if (idx === -1) {
		throw new AgentError(AGENT_ERRORS.NOT_FOUND, `Agent "${id}" not found.`);
	}

	if (updates.identity) {
		const existing = list[idx].identity ?? { name: id };
		list[idx].identity = {
			...existing,
			...updates.identity
		} as AgentIdentityConfig;
	}

	const newHash = writeConfig(config, hash);
	const syncTriggered = await triggerSyncPeers();

	return { agent: list[idx], hash: newHash, syncTriggered };
}

export async function deleteAgent(
	id: string,
	expectedHash: string
): Promise<{ hash: string; syncTriggered: boolean }> {
	const { config, hash } = readConfig();
	if (hash !== expectedHash) {
		throw new AgentError(
			AGENT_ERRORS.CONFLICT,
			'Config was modified externally. Please refresh and try again.'
		);
	}

	const list = ensureAgentsList(config);
	const idx = list.findIndex((a) => a.id === id);
	if (idx === -1) {
		throw new AgentError(AGENT_ERRORS.NOT_FOUND, `Agent "${id}" not found.`);
	}

	if (idx === 0) {
		throw new AgentError(AGENT_ERRORS.PROTECTED, 'Cannot delete the primary agent.');
	}

	list.splice(idx, 1);

	// Disable agent-to-agent if back to single agent
	if (list.length === 1) {
		setNestedValue(config, 'tools.agentToAgent.enabled', false);
	}

	const newHash = writeConfig(config, hash);
	const syncTriggered = await triggerSyncPeers();

	return { hash: newHash, syncTriggered };
}
