import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createWorkBlockerLink, listWorkBlockerLinks, WorkError } from '$lib/server/work/index.js';
import type { WorkBlockerStatus } from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const state = url.searchParams.get('state') ?? url.searchParams.get('status') ?? 'active';
		const blockers = listWorkBlockerLinks({
			project_id: numberParam(url, 'project_id') ?? undefined,
			blocked_item_id: numberParam(url, 'blocked_item_id') ?? undefined,
			blocker_item_id: numberParam(url, 'blocker_item_id') ?? undefined,
			status: state === 'all' ? 'all' : (state as WorkBlockerStatus),
			limit: numberParam(url, 'limit') ?? undefined
		});
		return json({ blockers, total: blockers.length, sourceOfTruth: 'work' });
	} catch (err) {
		return handleWorkError(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const blocker = createWorkBlockerLink({
			...body,
			actor: body.actor ?? 'agent'
		});
		return json(blocker, { status: 201 });
	} catch (err) {
		return handleWorkError(err);
	}
};

function numberParam(url: URL, name: string): number | null {
	const value = url.searchParams.get(name);
	if (!value) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function handleWorkError(err: unknown): Response {
	if (err instanceof WorkError) {
		const status = err.code === 'WORK_NOT_FOUND' ? 404 : err.code === 'WORK_DUPLICATE' ? 409 : 400;
		return json({ error: err.message, code: err.code }, { status });
	}
	const message = err instanceof Error ? err.message : 'Internal server error';
	return json({ error: message, code: 'WORK_INTERNAL' }, { status: 500 });
}
