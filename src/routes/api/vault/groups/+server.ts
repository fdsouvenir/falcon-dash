import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listGroups, createGroup } from '$lib/server/vault/vault.js';

export const GET: RequestHandler = async () => {
	try {
		const groups = await listGroups();
		return json({ groups });
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let body: { path: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.path) throw error(400, 'path is required');

	try {
		await createGroup(body.path);
		return json({ ok: true, path: body.path }, { status: 201 });
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};
