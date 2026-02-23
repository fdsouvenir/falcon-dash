import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getAgent, updateAgent, deleteAgent, handleAgentError } from '$lib/server/agents/index.js';

/** GET: Get a single agent by ID */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const agent = getAgent(params.id);
		if (!agent) {
			return json(
				{ error: `Agent "${params.id}" not found`, code: 'AGENT_NOT_FOUND' },
				{ status: 404 }
			);
		}
		return json({ agent });
	} catch (err) {
		return handleAgentError(err);
	}
};

/** PATCH: Update agent identity */
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const { identity, hash } = body;

		if (!hash || typeof hash !== 'string') {
			return json({ error: 'Config hash is required', code: 'AGENT_INVALID' }, { status: 400 });
		}

		const result = await updateAgent(params.id, { identity }, hash);
		return json(result);
	} catch (err) {
		return handleAgentError(err);
	}
};

/** DELETE: Remove an agent */
export const DELETE: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const { hash } = body;

		if (!hash || typeof hash !== 'string') {
			return json({ error: 'Config hash is required', code: 'AGENT_INVALID' }, { status: 400 });
		}

		const result = await deleteAgent(params.id, hash);
		return json(result);
	} catch (err) {
		return handleAgentError(err);
	}
};
