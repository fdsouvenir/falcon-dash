import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { resolveProjectProofSources } from '$lib/server/work3/project-proof-sources.js';
import { makeCommandAction } from '$lib/server/work3/ui.js';

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const project = await getObjectReader('project').get(params.id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
	if (!project) throw httpError(404, `No such project: ${params.id}`);
	await resolveProjectProofSources(project);
	return { project, now: Date.now() };
};

export const actions: Actions = {
	command: makeCommandAction('project')
};
