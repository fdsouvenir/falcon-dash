import { call } from '$lib/stores/gateway.js';

export interface AgentIdentity {
	agentId: string;
	name: string;
	avatar: string;
	emoji: string | undefined;
}

const FALLBACK: AgentIdentity = { agentId: '', name: 'Agent', avatar: '', emoji: undefined };

export async function getAgentIdentity(agentId?: string): Promise<AgentIdentity> {
	try {
		return await call<AgentIdentity>('agent.identity.get', agentId ? { agentId } : {});
	} catch {
		return FALLBACK;
	}
}
