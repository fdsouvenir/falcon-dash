import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { makeCommandAction } from '$lib/server/work3/ui.js';

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const change = getObjectReader('change_request').get(params.id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
	if (!change) throw httpError(404, `No such change request: ${params.id}`);
	const plan = change.plan_id
		? getObjectReader('plan').get(change.plan_id as string, {
				view: 'full',
				filters: {},
				limit: 1,
				offset: 0
			})
		: null;
	return { change, plan };
};

export const actions: Actions = {
	command: makeCommandAction('change_request')
};
