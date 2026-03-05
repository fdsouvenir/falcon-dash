import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getStatus } from '$lib/server/vault/vault.js';

export const GET: RequestHandler = async () => {
	const status = await getStatus();
	return json(status, { status: status.available ? 200 : 503 });
};
