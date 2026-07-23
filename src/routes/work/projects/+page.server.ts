import type { PageServerLoad } from './$types.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';

export const load: PageServerLoad = async () => {
	startWork3();
	const projects = await getObjectReader('project').list({
		view: 'list',
		filters: {},
		limit: 100,
		offset: 0
	});
	return { projects: projects.items };
};
