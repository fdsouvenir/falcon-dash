import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { reconcileWorkItem } from '$lib/server/work/index.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { itemId?: number; forceAgent?: boolean };
		if (!body.itemId) return json({ error: 'itemId is required' }, { status: 400 });
		const result = await reconcileWorkItem(Number(body.itemId), {
			forceAgent: Boolean(body.forceAgent),
			triggerEntity: 'manual',
			triggerId: body.itemId
		});
		return json(result.run);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, { status: 500 });
	}
};
