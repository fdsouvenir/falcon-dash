import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { deleteGroup } from '$lib/server/vault/vault.js';

export const DELETE: RequestHandler = async ({ params }) => {
	const path = params.path;
	if (!path) throw error(400, 'path is required');

	try {
		await deleteGroup(path);
		return json({ ok: true });
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};
