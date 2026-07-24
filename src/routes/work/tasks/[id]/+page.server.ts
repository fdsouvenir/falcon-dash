import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { legalCommandsFor, startWork3, type TaskStatus } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { makeCommandAction } from '$lib/server/work3/ui.js';

async function loadTaskDetail(id: string) {
	return await getObjectReader('task').get(id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
}

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const task = await loadTaskDetail(params.id);
	if (!task) throw httpError(404, `No such task: ${params.id}`);
	return {
		task,
		legalCommands: legalCommandsFor(task.status as TaskStatus)
	};
};

export const actions: Actions = {
	command: makeCommandAction('task')
};
