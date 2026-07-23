import type { PageServerLoad } from './$types.js';
import { computeQueue, startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';

/** Needs Resolution (doc 05): Questions, Decisions, Reviews, Authorizations
 * requiring human attention. */
export const load: PageServerLoad = async () => {
	startWork3();
	const queue = await computeQueue();
	const questions = await getObjectReader('question').list({
		view: 'list',
		filters: { status: 'open' },
		limit: 50,
		offset: 0
	});
	const decisions = await getObjectReader('decision').list({
		view: 'detail',
		filters: { status: 'pending' },
		limit: 50,
		offset: 0
	});
	const deferred = await getObjectReader('decision').list({
		view: 'detail',
		filters: { status: 'deferred' },
		limit: 50,
		offset: 0
	});
	return {
		questions: questions.items,
		decisions: [...decisions.items, ...deferred.items],
		awaitingReview: queue.awaiting_review,
		changesNeeding: queue.changes_needing_authorization_or_verification
	};
};
