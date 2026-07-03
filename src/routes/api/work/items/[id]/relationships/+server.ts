import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	createWorkRelationship,
	deleteWorkRelationship,
	listWorkRelationships,
	WorkError
} from '$lib/server/work/index.js';
import type { WorkRelationType } from '$lib/server/work/index.js';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const relationships = listWorkRelationships(Number(params.id));
		return json({ relationships });
	} catch (err) {
		return handleWorkError(err);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as {
			to_item_id?: number;
			from_item_id?: number;
			relation_type?: WorkRelationType;
		};
		const relationship = createWorkRelationship({
			from_item_id: body.from_item_id ?? Number(params.id),
			to_item_id: Number(body.to_item_id),
			relation_type: body.relation_type ?? 'relates_to',
			actor: 'agent'
		});
		return json(relationship, { status: 201 });
	} catch (err) {
		return handleWorkError(err);
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as {
			to_item_id?: number;
			from_item_id?: number;
			relation_type?: WorkRelationType;
		};
		const deleted = deleteWorkRelationship({
			from_item_id: body.from_item_id ?? Number(params.id),
			to_item_id: Number(body.to_item_id),
			relation_type: body.relation_type ?? 'relates_to',
			actor: 'agent'
		});
		return json({ deleted });
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
