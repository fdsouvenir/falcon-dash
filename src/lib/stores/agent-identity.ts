import { rpc, gatewayEvents } from '$lib/gateway-api.js';

export interface AgentIdentity {
	agentId: string;
	name: string;
	avatar: string;
	emoji: string | undefined;
}

const FALLBACK: AgentIdentity = { agentId: '', name: 'Agent', avatar: '', emoji: undefined };

/** Readable store — re-subscribe in `$effect` to trigger fetch after reconnect. */
export const connectionState = gatewayEvents.state;

export async function getAgentIdentity(agentId?: string): Promise<AgentIdentity> {
	try {
		return await rpc<AgentIdentity>('agent.identity.get', agentId ? { agentId } : {});
	} catch {
		return FALLBACK;
	}
}
