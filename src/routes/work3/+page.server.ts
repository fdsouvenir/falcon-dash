import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { executePersonCommand } from '$lib/server/work3/person.js';

export const load: PageServerLoad = async ({ url }) => {
	startWork3();
	const statusFilter = url.searchParams.get('status') ?? undefined;
	const areaFilter = url.searchParams.get('area') ?? undefined;

	const tasks = getObjectReader('task').list({
		view: 'list',
		filters: {
			...(statusFilter ? { status: statusFilter } : {}),
			...(areaFilter ? { area: areaFilter } : {})
		},
		limit: 100,
		offset: 0
	});
	const areas = getObjectReader('area').list({
		view: 'list',
		filters: {},
		limit: 100,
		offset: 0
	});
	return {
		tasks: tasks.items,
		taskTotal: tasks.total,
		areas: areas.items,
		statusFilter: statusFilter ?? '',
		areaFilter: areaFilter ?? ''
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
