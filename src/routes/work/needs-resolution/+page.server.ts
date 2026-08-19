import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { isWork3Error, Work3Error } from '$lib/work3-shared/errors.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { executePersonCommand } from '$lib/server/work3/person.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { formScalarValue } from '$lib/server/work3/ui.js';
import { commandLabel, requiresConfirmation } from '$lib/work3/labels.js';

/** Needs Resolution (doc 05): Questions, Decisions, Reviews, and Authorizations. */
export const load: PageServerLoad = async () => {
	startWork3();
	const plans = await getObjectReader('plan').list({
		view: 'list',
		filters: {},
		limit: 200,
		offset: 0
	});
	const questions = await getObjectReader('question').list({
		view: 'list',
		filters: { status: 'open' },
		limit: 50,
		offset: 0
	});
	const decisions = await getObjectReader('decision').list({
		view: 'detail',
		filters: { status: 'pending' },
		limit: 50,
		offset: 0
	});
	const deferred = await getObjectReader('decision').list({
		view: 'detail',
		filters: { status: 'deferred' },
		limit: 50,
		offset: 0
	});
	const changes = await getObjectReader('change_request').list({
		view: 'detail',
		filters: {},
		limit: 200,
		offset: 0
	});
	const awaitingReview = plans.items.filter(
		(plan) => plan.state === 'submitted' && plan.review_disposition === 'unreviewed'
	);
	const planStates = new Map(plans.items.map((plan) => [plan.id, plan.state]));
	const authorizationItems = changes.items
		.filter((change) => change.next_action?.includes('authorize_change'))
		.map((change) => {
			const authorization = change.authorization as { state?: unknown } | undefined;
			const planReady = planStates.get(change.plan_id) === 'submitted';
			return {
				id: change.id,
				type: 'change_request',
				title: change.title,
				version: change.version,
				updated_at: change.updated_at,
				plan_ready: planReady,
				why: `Authorization ${String(authorization?.state ?? 'missing')}${planReady ? '' : ' (plan not submitted)'}`
			};
		})
		.sort((left, right) => {
			if (left.plan_ready !== right.plan_ready) return left.plan_ready ? -1 : 1;
			return Number(right.updated_at ?? 0) - Number(left.updated_at ?? 0);
		});
	return {
		questions: questions.items,
		decisions: [...decisions.items, ...deferred.items],
		awaitingReview: {
			items: awaitingReview,
			total: awaitingReview.length
		},
		authorizations: {
			total: authorizationItems.length,
			items: authorizationItems
		}
	};
};

export const actions: Actions = {
	/** Review is targetless creation, so it is scoped to this resolution route. */
	command: async (event) => {
		startWork3();
		const form = await event.request.formData();
		const values = Object.fromEntries(form) as Record<string, string>;
		const command = values.command;
		if (command !== 'create_review') {
			return fail(400, {
				error: new Work3Error(
					'validation_failed',
					'Only Review outcomes can be recorded from this route'
				).toShape(),
				values,
				command
			});
		}
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
				try {
					payload[key.slice('payload_'.length)] = formScalarValue(
						key.slice('payload_'.length),
						value
					);
				} catch (error) {
					if (isWork3Error(error)) {
						return fail(400, { error: error.toShape(), values, command });
					}
					throw error;
				}
			}
		}

		try {
			const result = await executePersonCommand(event, { command, payload });
			return { ok: true, command, noop: result.noop };
		} catch (error) {
			if (isWork3Error(error)) {
				return fail(400, { error: error.toShape(), values, command });
			}
			throw error;
		}
	}
};
