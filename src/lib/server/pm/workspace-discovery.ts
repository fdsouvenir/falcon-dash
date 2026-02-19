import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface AgentWorkspace {
	name: string;
	workspace: string;
}

/**
 * Reads ~/.openclaw/openclaw.json and discovers agent workspace paths.
 * Falls back to agents.defaults.workspace or ~/.openclaw/workspace.
 */
export function discoverAgentWorkspaces(): AgentWorkspace[] {
	const configPath = join(homedir(), '.openclaw', 'openclaw.json');
	const defaultWorkspace = join(homedir(), '.openclaw', 'workspace');

	if (!existsSync(configPath)) {
		return [{ name: 'default', workspace: defaultWorkspace }];
	}

	try {
		const raw = readFileSync(configPath, 'utf-8');
		const config = JSON.parse(raw);

		const agents = config?.agents;
		if (!agents?.list || !Array.isArray(agents.list) || agents.list.length === 0) {
			return [{ name: 'default', workspace: defaultWorkspace }];
		}

		const fallbackWorkspace = agents.defaults?.workspace ?? defaultWorkspace;
		const workspaces: AgentWorkspace[] = [];
		const seen = new Set<string>();

		for (const agent of agents.list) {
			const ws = agent.workspace ?? fallbackWorkspace;
			const name = agent.name ?? agent.id ?? 'unknown';
			// Deduplicate by workspace path
			if (!seen.has(ws)) {
				seen.add(ws);
				workspaces.push({ name, workspace: ws });
			}
		}

		return workspaces.length > 0 ? workspaces : [{ name: 'default', workspace: defaultWorkspace }];
	} catch {
		return [{ name: 'default', workspace: defaultWorkspace }];
	}
}
