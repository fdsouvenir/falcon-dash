import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { parseAllSessions } from '$lib/server/ops/parser.js';

/**
 * GET /api/ops/entries — returns merged entries from all recent sessions.
 * Query params: ?types=exec|all, ?limit=100, ?maxSessions=10
 */
export const GET: RequestHandler = async ({ url }) => {
	const types = (url.searchParams.get('types') ?? 'all') as 'exec' | 'all';
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);
	const maxSessions = Math.min(parseInt(url.searchParams.get('maxSessions') ?? '10', 10), 20);

	try {
		const entries = await parseAllSessions({ types, limit, maxSessions });
		return json({ entries });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
