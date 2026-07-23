import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listAgentTokens, mintAgentToken } from '$lib/server/work3/auth.js';
import { startWork3 } from '$lib/server/work3/index.js';

/**
 * Operator-UI token management (same-origin, in-process — NOT /api/v3).
 * Minting returns the plaintext token exactly once; only hashes are stored.
 */

export const GET: RequestHandler = async () => {
	startWork3();
	return json({ tokens: listAgentTokens() });
};

export const POST: RequestHandler = async ({ request }) => {
	startWork3();
	let body: { agent_id?: string; label?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be JSON' }, { status: 400 });
	}
	const agentId = body.agent_id?.trim();
	if (!agentId || !/^[A-Za-z0-9_-]+$/.test(agentId)) {
		return json(
			{ error: 'agent_id is required (letters, digits, underscore, hyphen)' },
			{ status: 400 }
		);
	}
	const minted = mintAgentToken({ agentId, label: body.label?.trim() || undefined });
	return json({
		token: minted.token,
		token_file: minted.tokenFile,
		record: minted.record
	});
};
