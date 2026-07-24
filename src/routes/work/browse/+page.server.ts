import type { PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { searchWork, startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';

/** Browse (doc 05): search + filter across all Work, including terminal. */
export const load: PageServerLoad = async ({ url }) => {
	startWork3();
	const query = url.searchParams.get('q') ?? '';
	const type = url.searchParams.get('type') ?? '';
	let results: Array<Record<string, unknown>> = [];
	let searchError: string | null = null;
	if (query) {
		try {
			results = searchWork(query, { type: type || undefined, limit: 50 });
		} catch (error) {
			// Unsupported fields fail visibly, never silently (doc 05).
			if (isWork3Error(error)) searchError = error.message;
			else throw error;
		}
	}
	const tasks = await getObjectReader('task').list({
		view: 'list',
		filters: {},
		limit: 50,
		offset: 0
	});
	const findings = await getObjectReader('finding').list({
		view: 'list',
		filters: {},
		limit: 25,
		offset: 0
	});
	return {
		query,
		type,
		results,
		searchError,
		tasks: tasks.items,
		taskTotal: tasks.total,
		findings: findings.items
	};
};
