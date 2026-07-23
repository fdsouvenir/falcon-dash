import { error as httpError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { executePersonCommand } from '$lib/server/work3/person.js';

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const automaton = await getObjectReader('automaton').get(params.id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
	if (!automaton) throw httpError(404, `No such automaton: ${params.id}`);
	return { automaton };
};

export const actions: Actions = {
	// Automaton commands carry the OpenClaw id in the payload (no envelope
	// target/expected_version — runtime concurrency uses updatedAtMs).
	command: async (event) => {
		startWork3();
		const form = await event.request.formData();
		const values = Object.fromEntries(form) as Record<string, string>;
		const payload: Record<string, unknown> = { id: event.params.id };
		if (values.expected_runtime_updated_at_ms) {
			payload.expected_runtime_updated_at_ms = Number(values.expected_runtime_updated_at_ms);
		}
		for (const [key, value] of Object.entries(values)) {
			if (key.startsWith('payload_') && value !== '') {
				payload[key.slice('payload_'.length)] = value;
			}
		}
		try {
			const result = await executePersonCommand(event, { command: values.command, payload });
			return { ok: true, command: values.command, noop: result.noop, result: result.result };
		} catch (error) {
			if (isWork3Error(error)) {
				return fail(400, { error: error.toShape(), command: values.command });
			}
			throw error;
		}
	}
};
