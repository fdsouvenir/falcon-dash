import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { searchWork, startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { executePersonCommand } from '$lib/server/work3/person.js';

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
	const areas = await getObjectReader('area').list({
		view: 'list',
		filters: {},
		limit: 100,
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
		areas: areas.items,
		findings: findings.items
	};
};

export const actions: Actions = {
	create_area: async (event) => {
		startWork3();
		const form = await event.request.formData();
		const values = Object.fromEntries(form) as Record<string, string>;
		try {
			await executePersonCommand(event, {
				command: 'create_area',
				payload: { title: values.title, summary: values.summary || undefined }
			});
			return { created: 'area' };
		} catch (error) {
			if (isWork3Error(error)) return fail(400, { error: error.toShape(), values, form: 'area' });
			throw error;
		}
	},
	create_task: async (event) => {
		startWork3();
		const form = await event.request.formData();
		const values = Object.fromEntries(form) as Record<string, string>;
		try {
			await executePersonCommand(event, {
				command: 'create_task',
				payload: {
					title: values.title,
					area_id: values.area_id,
					summary: values.summary || undefined,
					priority: values.priority || undefined,
					owner: values.owner || undefined
				}
			});
			return { created: 'task' };
		} catch (error) {
			if (isWork3Error(error)) return fail(400, { error: error.toShape(), values, form: 'task' });
			throw error;
		}
	}
};
