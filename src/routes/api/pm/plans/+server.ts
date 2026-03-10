import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listPlans, createPlan } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { requireNumber } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const projectIdParam = url.searchParams.get('project_id');
		const statusParam = url.searchParams.get('status');

		const filters: { project_id?: number; status?: string } = {};
		if (projectIdParam) filters.project_id = requireNumber(projectIdParam, 'project_id');
		if (statusParam) filters.status = statusParam;

		const items = listPlans(filters);

		return json({ items, total: items.length });
	} catch (err) {
		return handlePMError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const plan = createPlan(body);
		emitPMEvent({ 
			action: 'created', 
			entityType: 'plan', 
			entityId: plan.id,
			projectId: plan.project_id,
			data: body 
		});
		triggerContextGeneration();
		return json(plan, { status: 201 });
	} catch (err) {
		return handlePMError(err);
	}
};