import { fail, type RequestEvent } from '@sveltejs/kit';
import { isWork3Error, Work3Error } from '$lib/work3-shared/errors.js';
import { startWork3 } from './index.js';
import { getObjectReader } from './read/registry.js';
import { executePersonCommand } from './person.js';

/**
 * Shared operator-UI form action for semantic commands (person adapter).
 * Form fields: command, expected_version, payload_* (strings) and
 * payload_json_* (JSON-encoded structured fields). Failures return the
 * structured error plus the submitted values so the UI preserves user input
 * (doc 05 conflict recovery).
 */
export function makeCommandAction(objectType: string) {
	return async (event: RequestEvent) => {
		startWork3();
		const form = await event.request.formData();
		const values = Object.fromEntries(form) as Record<string, string>;
		const command = values.command;
		const targetId = (event.params as Record<string, string>).id;

		const payload: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(values)) {
			if (key.startsWith('payload_json_') && value !== '') {
				try {
					payload[key.slice('payload_json_'.length)] = JSON.parse(value);
				} catch {
					return fail(400, {
						error: new Work3Error('validation_failed', `${key} is not valid JSON`).toShape(),
						values,
						command
					});
				}
			} else if (key.startsWith('payload_') && value !== '') {
				payload[key.slice('payload_'.length)] = value;
			}
		}

		try {
			const result = await executePersonCommand(event, {
				command,
				target: targetId,
				expected_version: Number(values.expected_version),
				payload
			});
			return { ok: true, command, noop: result.noop };
		} catch (error) {
			if (isWork3Error(error)) {
				const current = await getObjectReader(objectType).get(targetId, {
					view: 'detail',
					filters: {},
					limit: 1,
					offset: 0
				});
				return fail(400, {
					error: error.toShape(),
					values,
					command,
					current_version: (current?.version as number | undefined) ?? null
				});
			}
			throw error;
		}
	};
}
