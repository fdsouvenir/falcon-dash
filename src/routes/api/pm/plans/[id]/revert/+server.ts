import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { revertPlanVersion } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS, parseId, requireNumber } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const planId = parseId(params.id);
		const body = await request.json();
		const version = requireNumber(body.version, 'version');
		
		const plan = revertPlanVersion(planId, version);
		if (!plan) throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Plan ${planId} or version ${version} not found`);
		
		emitPMEvent({
			action: 'reverted',
			entityType: 'plan',
			entityId: planId,
			projectId: plan.project_id,
			data: { version }
		});
		triggerContextGeneration();
		return json(plan);
	} catch (err) {
		return handlePMError(err);
	}
};