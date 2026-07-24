import { fail, type RequestEvent } from '@sveltejs/kit';
import { commandMeta, WORK3_COMMANDS, type Work3CommandMeta } from '$lib/work3-shared/commands.js';
import { isWork3Error, Work3Error } from '$lib/work3-shared/errors.js';
import { commandLabel, requiresConfirmation } from '$lib/work3/labels.js';
import { startWork3 } from './index.js';
import { getWork3Db } from './db.js';
import { getObjectReader } from './read/registry.js';
import { executePersonCommand } from './person.js';

export function formDateToEpoch(value: string): number {
	if (/^\d+$/.test(value)) {
		const epoch = Number(value);
		return validEpoch(epoch) ? epoch : Number.NaN;
	}
	if (
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
	) {
		return Number.NaN;
	}
	const epoch = Date.parse(value);
	return validEpoch(epoch) ? epoch : Number.NaN;
}

function validEpoch(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
}

const numericFormFields = new Set(['sequence', 'expected_runtime_updated_at_ms']);
const booleanFormFields = new Set([
	'clear',
	'enabled',
	'one_time',
	'parallel',
	'parallel_phases_allowed'
]);

export function formScalarValue(field: string, value: string): string | number | boolean {
	if (field.endsWith('_at') || field.endsWith('_until') || field === 'until') {
		const numeric = formDateToEpoch(value);
		if (!Number.isFinite(numeric)) {
			throw new Work3Error('validation_failed', `${field} must be a valid date and time`);
		}
		return numeric;
	}
	if (numericFormFields.has(field)) {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) {
			throw new Work3Error('validation_failed', `${field} must be a number`);
		}
		return numeric;
	}
	if (booleanFormFields.has(field)) {
		if (value === 'true') return true;
		if (value === 'false') return false;
		throw new Work3Error('validation_failed', `${field} must be true or false`);
	}
	return value;
}

export function commandDispatchTarget(
	command: string,
	pageTargetId: string,
	postedTargetId?: string,
	expectedVersion?: string
): { targetType: string | null | undefined; target?: string; expectedVersion?: number } {
	const targetType = commandMeta(command)?.target;
	if (targetType === null) return { targetType };
	return {
		targetType,
		target: postedTargetId || pageTargetId,
		...(expectedVersion === undefined ? {} : { expectedVersion: Number(expectedVersion) })
	};
}

export function commandTargetAllowed(
	targetType: string | null | undefined,
	objectType: string,
	pageTargetId: string,
	postedTargetId?: string,
	childProjectId?: string
): boolean {
	if (targetType === null) return true;
	if (targetType === objectType) {
		return postedTargetId === undefined || postedTargetId === pageTargetId;
	}
	if (objectType === 'project' && (targetType === 'phase' || targetType === 'milestone')) {
		return postedTargetId !== undefined && childProjectId === pageTargetId;
	}
	return false;
}

export function projectLocalCreationAllowed(
	command: string,
	objectType: string,
	pageTargetId: string,
	payloadProjectId: unknown
): boolean {
	const targetType = commandMeta(command)?.target;
	if (targetType === undefined) return false;
	if (targetType !== null) return true;
	return (
		objectType === 'project' &&
		(command === 'create_phase' || command === 'create_milestone') &&
		payloadProjectId === pageTargetId
	);
}

export function requiredCommandMeta(command: string | undefined): Work3CommandMeta {
	const meta = command ? commandMeta(command) : undefined;
	if (!meta) {
		throw new Work3Error('unknown_command', `Unknown command: ${command ?? '(missing)'}`, {
			alternatives: WORK3_COMMANDS.map((candidate) => candidate.name)
		});
	}
	return meta;
}

/**
 * Shared operator-UI form action for semantic commands (person adapter).
 * Form fields: command, expected_version, typed payload_* scalars and
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
		const pageTargetId = (event.params as Record<string, string>).id;
		let meta: Work3CommandMeta;
		try {
			meta = requiredCommandMeta(command);
		} catch (error) {
			if (isWork3Error(error)) {
				return fail(404, { error: error.toShape(), values, command });
			}
			throw error;
		}
		const targetType = meta.target;
		const childProjectId =
			objectType === 'project' &&
			values.target_id &&
			(targetType === 'phase' || targetType === 'milestone')
				? (
						getWork3Db()
							.prepare(
								`SELECT project_id FROM ${targetType === 'phase' ? 'phases' : 'milestones'}
								  WHERE entity_id = ?`
							)
							.get(values.target_id) as { project_id: string } | undefined
					)?.project_id
				: undefined;
		if (
			!commandTargetAllowed(targetType, objectType, pageTargetId, values.target_id, childProjectId)
		) {
			return fail(400, {
				error: new Work3Error(
					'validation_failed',
					`${commandLabel(command)} target does not belong to this ${objectType} page`
				).toShape(),
				values,
				command
			});
		}
		const dispatchTarget = commandDispatchTarget(
			command,
			pageTargetId,
			values.target_id,
			values.expected_version
		);

		if (requiresConfirmation(command) && values.confirmed !== 'yes') {
			return fail(400, {
				error: new Work3Error(
					'validation_failed',
					`${commandLabel(command)} requires explicit confirmation`
				).toShape(),
				values,
				command
			});
		}

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
				const field = key.slice('payload_'.length);
				try {
					payload[field] = formScalarValue(field, value);
				} catch (error) {
					if (isWork3Error(error)) {
						return fail(400, {
							error: error.toShape(),
							values,
							command
						});
					}
					throw error;
				}
			}
		}
		if (!projectLocalCreationAllowed(command, objectType, pageTargetId, payload.project_id)) {
			return fail(400, {
				error: new Work3Error(
					'validation_failed',
					`${commandLabel(command)} is not available from this ${objectType} page`
				).toShape(),
				values,
				command
			});
		}

		try {
			const result = await executePersonCommand(event, {
				command,
				target: dispatchTarget.target,
				expected_version: dispatchTarget.expectedVersion,
				payload
			});
			return { ok: true, command, noop: result.noop };
		} catch (error) {
			if (isWork3Error(error)) {
				const current = await getObjectReader(dispatchTarget.targetType ?? objectType).get(
					dispatchTarget.target ?? pageTargetId,
					{
						view: 'detail',
						filters: {},
						limit: 1,
						offset: 0
					}
				);
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
