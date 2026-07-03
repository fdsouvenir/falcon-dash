import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createContextualAgentSession } from '$lib/server/work/index.js';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			mode?: 'ask' | 'reconcile';
			message?: string;
		};
		const mode = body.mode === 'reconcile' ? 'reconcile' : 'ask';
		const result = await createContextualAgentSession(Number(params.id), {
			mode,
			message: body.message
		});
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, { status: 500 });
	}
};
