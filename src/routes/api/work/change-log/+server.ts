import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listWorkChangeLog, WorkError } from '$lib/server/work/index.js';
import type { WorkChangeEntityType } from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const projectId = numberParam(url, 'project_id');
		const entityId = url.searchParams.get('entity_id');
		const entityType = url.searchParams.get('entity_type') as WorkChangeEntityType | null;
		const areaId = url.searchParams.get('area_id');
		const limit = numberParam(url, 'limit');
		const entries = listWorkChangeLog({
			project_id: projectId ?? undefined,
			entity_type: entityType ?? undefined,
			entity_id: entityId ?? undefined,
			area_id: areaId ?? undefined,
			limit: limit ?? undefined
		});
		return json({ entries, total: entries.length, sourceOfTruth: 'work' });
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
