import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { makeCommandAction } from '$lib/server/work3/ui.js';

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const decision = await getObjectReader('decision').get(params.id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
	if (!decision) throw httpError(404, `No such decision: ${params.id}`);
	return { decision };
};

export const actions: Actions = {
	command: makeCommandAction('decision')
};
