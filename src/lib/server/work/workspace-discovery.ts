import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AgentWorkspace {
	name: string;
	workspace: string;
}

export function discoverAgentWorkspaces(): AgentWorkspace[] {
	const configPath = join(homedir(), '.openclaw', 'openclaw.json');
	const defaultWorkspace = join(homedir(), '.openclaw', 'workspace');

	if (!existsSync(configPath)) return [{ name: 'default', workspace: defaultWorkspace }];

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
			const workspace = agent.workspace ?? fallbackWorkspace;
			const name = agent.name ?? agent.id ?? 'unknown';
			if (seen.has(workspace)) continue;
			seen.add(workspace);
			workspaces.push({ name, workspace });
		}

		return workspaces.length > 0 ? workspaces : [{ name: 'default', workspace: defaultWorkspace }];
	} catch {
		return [{ name: 'default', workspace: defaultWorkspace }];
	}
}
