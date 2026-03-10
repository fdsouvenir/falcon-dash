import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	getPlan,
	updatePlan,
	deletePlan,
	listPlanVersions,
	revertPlanVersion
} from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS, parseId } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseId(params.id);
		const plan = getPlan(id);
		if (!plan) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Plan ${id} not found`);
		return json(plan);
	} catch (err) {
		return handlePMError(err);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseId(params.id);
		const body = await request.json();
		const plan = updatePlan(id, body);
		if (!plan) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Plan ${id} not found`);

		emitPMEvent({
			action: 'updated',
			entityType: 'plan',
			entityId: id,
			projectId: plan.project_id,
			data: body
		});
		triggerContextGeneration();
		return json(plan);
	} catch (err) {
		return handlePMError(err);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseId(params.id);
		const plan = getPlan(id);
		if (!plan) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Plan ${id} not found`);

		const deleted = deletePlan(id);
		if (!deleted) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Plan ${id} not found`);

		emitPMEvent({
			action: 'deleted',
			entityType: 'plan',
			entityId: id,
			projectId: plan.project_id
		});
		triggerContextGeneration();
		return json({ success: true });
	} catch (err) {
		return handlePMError(err);
	}
};
