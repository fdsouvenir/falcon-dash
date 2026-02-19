import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listComments, createComment } from '$lib/server/pm/crud.js';
import { handlePMError } from '$lib/server/pm/errors.js';
import { PMError, PM_ERRORS } from '$lib/server/pm/validation.js';
import { emitPMEvent } from '$lib/server/pm/events.js';
import { triggerContextGeneration } from '$lib/server/pm/context-scheduler.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const page = parseInt(url.searchParams.get('page') ?? '1');
		const limit = parseInt(url.searchParams.get('limit') ?? '50');
		const targetType = url.searchParams.get('target_type');
		const targetIdParam = url.searchParams.get('target_id');

		if (!targetType || !targetIdParam) {
			throw new PMError(
				PM_ERRORS.PM_CONSTRAINT,
				'target_type and target_id are required query parameters'
			);
		}

		const targetId = parseInt(targetIdParam);
		const items = listComments(targetType, targetId);
		const total = items.length;
		const start = (page - 1) * limit;
		const paged = items.slice(start, start + limit);
		return json({ items: paged, total, page, limit, hasMore: start + limit < total });
	} catch (err) {
		return handlePMError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const comment = createComment(body);
		emitPMEvent({
			action: 'created',
			entityType: 'comment',
			entityId: comment.id,
			data: body
		});
		triggerContextGeneration();
		return json(comment, { status: 201 });
	} catch (err) {
		return handlePMError(err);
	}
};
