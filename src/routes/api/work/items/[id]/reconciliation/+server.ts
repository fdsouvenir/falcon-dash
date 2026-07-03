import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listReconciliationRunsForItem } from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const runs = listReconciliationRunsForItem(Number(params.id));
		return json({ runs });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, { status: 500 });
	}
};
