import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { parseSession } from '$lib/server/ops/parser.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const { sessionId } = params;
	const types = (url.searchParams.get('types') ?? 'all') as 'exec' | 'all';
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
	const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

	try {
		const entries = await parseSession(sessionId, { types, limit, offset });
		return json({ entries });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
