import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { revokeAgentToken } from '$lib/server/work3/auth.js';
import { startWork3 } from '$lib/server/work3/index.js';

export const DELETE: RequestHandler = async ({ params }) => {
	startWork3();
	const revoked = revokeAgentToken(params.id);
	if (!revoked) {
		return json({ error: 'No active token with that id' }, { status: 404 });
	}
	return json({ ok: true });
};
