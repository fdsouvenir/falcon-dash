import type { PageServerLoad } from './$types.js';
import { computeQueue, materialRecentChanges, startWork3 } from '$lib/server/work3/index.js';

/** Mission Control (doc 05): the smallest set of actions that can materially
 * advance Work, plus the material-recent-changes feed. */
export const load: PageServerLoad = async () => {
	startWork3();
	const queue = await computeQueue();
	return {
		queue,
		recentChanges: materialRecentChanges(15)
	};
};
