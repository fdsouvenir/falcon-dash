import { error as httpError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { legalCommandsFor, startWork3, type TaskStatus } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { executePersonCommand } from '$lib/server/work3/person.js';

function loadTaskDetail(id: string) {
	return getObjectReader('task').get(id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
}

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const task = loadTaskDetail(params.id);
	if (!task) throw httpError(404, `No such task: ${params.id}`);
	return {
		task,
		legalCommands: legalCommandsFor(task.status as TaskStatus)
	};
};

export const actions: Actions = {
	command: async (event) => {
		startWork3();
		const form = await event.request.formData();
		const values = Object.fromEntries(form) as Record<string, string>;
		const command = values.command;
		const expectedVersion = Number(values.expected_version);

		const payload: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(values)) {
			if (key.startsWith('payload_') && value !== '') {
				payload[key.slice('payload_'.length)] = value;
			}
		}

		try {
			const result = await executePersonCommand(event, {
				command,
				target: event.params.id,
				expected_version: expectedVersion,
				payload
			});
			return { ok: true, command, noop: result.noop };
		} catch (error) {
			if (isWork3Error(error)) {
				// Version conflicts return the current version so the UI can offer
				// refresh/reapply while preserving what the user typed (doc 05).
				const current = loadTaskDetail(event.params.id);
				return fail(400, {
					error: error.toShape(),
					values,
					command,
					current_version: current?.version ?? null
				});
			}
			throw error;
		}
	}
};
