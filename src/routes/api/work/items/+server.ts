import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createWorkItem, listWorkItems, WorkError } from '$lib/server/work/index.js';
import type { WorkItemType, WorkStatus } from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const type = url.searchParams.get('type') as WorkItemType | null;
		const status = url.searchParams.get('status') as WorkStatus | null;
		const areaId = url.searchParams.get('area_id');
		const includeClosed = url.searchParams.get('includeClosed') === 'true';
		const limitParam = url.searchParams.get('limit');
		const items = listWorkItems({
			type: type ?? undefined,
			status: status ?? undefined,
			area_id: areaId ?? undefined,
			includeClosed,
			limit: limitParam ? Number(limitParam) : undefined
		});
		return json({ items, total: items.length, sourceOfTruth: 'work' });
	} catch (err) {
		return handleWorkError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const item = createWorkItem({ ...body, actor: body.actor ?? 'agent' });
		return json(item, { status: 201 });
	} catch (err) {
		return handleWorkError(err);
	}
};

function handleWorkError(err: unknown): Response {
	if (err instanceof WorkError) {
		const status = err.code === 'WORK_NOT_FOUND' ? 404 : err.code === 'WORK_DUPLICATE' ? 409 : 400;
		return json({ error: err.message, code: err.code }, { status });
	}
	const message = err instanceof Error ? err.message : 'Internal server error';
	return json({ error: message, code: 'WORK_INTERNAL' }, { status: 500 });
}
