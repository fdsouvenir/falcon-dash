import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getEntry, editEntry, deleteEntry } from '$lib/server/vault/vault.js';

export const GET: RequestHandler = async ({ params }) => {
	const path = params.path;
	if (!path) throw error(400, 'path is required');

	try {
		const entry = await getEntry(path);
		return json(entry);
	} catch (err) {
		const msg = (err as Error).message;
		if (msg.includes('not found') || msg.includes('Could not find')) {
			throw error(404, `Entry not found: ${path}`);
		}
		throw error(500, msg);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const path = params.path;
	if (!path) throw error(400, 'path is required');

	let body: { title?: string; username?: string; password?: string; url?: string; notes?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	try {
		await editEntry(path, body);
		return json({ ok: true });
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const path = params.path;
	if (!path) throw error(400, 'path is required');

	try {
		await deleteEntry(path);
		return json({ ok: true });
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};
