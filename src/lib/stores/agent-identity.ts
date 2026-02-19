import { call, connection } from '$lib/stores/gateway.js';

export interface AgentIdentity {
	agentId: string;
	name: string;
	avatar: string;
	emoji: string | undefined;
}

const FALLBACK: AgentIdentity = { agentId: '', name: 'Agent', avatar: '', emoji: undefined };

/** Readable store — re-subscribe in `$effect` to trigger fetch after reconnect. */
export const connectionState = connection.state;

export async function getAgentIdentity(agentId?: string): Promise<AgentIdentity> {
	try {
		return await call<AgentIdentity>('agent.identity.get', agentId ? { agentId } : {});
	} catch {
		return FALLBACK;
	}
}
