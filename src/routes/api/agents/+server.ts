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

/** POST: Create a new agent */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { id, identity, hash } = body;

		if (!id || typeof id !== 'string') {
			return json({ error: 'Agent ID is required', code: 'AGENT_INVALID' }, { status: 400 });
		}
		if (!identity?.name || typeof identity.name !== 'string') {
			return json(
				{ error: 'Agent display name is required', code: 'AGENT_INVALID' },
				{ status: 400 }
			);
		}
		if (!hash || typeof hash !== 'string') {
			return json({ error: 'Config hash is required', code: 'AGENT_INVALID' }, { status: 400 });
		}

		const result = await createAgent({ id, identity }, hash);
		return json(result, { status: 201 });
	} catch (err) {
		return handleAgentError(err);
	}
};
