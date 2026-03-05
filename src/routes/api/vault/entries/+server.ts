import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listEntries, createEntry } from '$lib/server/vault/vault.js';

export const GET: RequestHandler = async ({ url }) => {
	const group = url.searchParams.get('group') ?? undefined;
	try {
		const result = await listEntries(group);
		return json(result);
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let body: { path: string; username?: string; password?: string; url?: string; notes?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.path) throw error(400, 'path is required');

	try {
		await createEntry(body.path, {
			username: body.username,
			password: body.password,
			url: body.url,
			notes: body.notes
		});
		return json({ ok: true, path: body.path }, { status: 201 });
	} catch (err) {
		throw error(500, (err as Error).message);
	}
};
