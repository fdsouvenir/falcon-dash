import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listAgents, createAgent, handleAgentError } from '$lib/server/agents/index.js';

/** GET: List all configured agents */
export const GET: RequestHandler = async () => {
	try {
		const result = listAgents();
		return json(result);
	} catch (err) {
		return handleAgentError(err);
	}
};

/** POST: Create a new agent (auto-generates ID if not provided) */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { id, identity, hash } = body;

		if (!hash || typeof hash !== 'string') {
			return json({ error: 'Config hash is required', code: 'AGENT_INVALID' }, { status: 400 });
		}

		const params =
			id || identity ? { id: id as string | undefined, identity: identity } : undefined;
		const result = await createAgent(params, hash);
		return json(result, { status: 201 });
	} catch (err) {
		return handleAgentError(err);
	}
};
