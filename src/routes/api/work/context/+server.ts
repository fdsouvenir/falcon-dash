import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateWorkContext } from '$lib/server/work/index.js';

export const GET: RequestHandler = async () => {
	return json(generateWorkContext());
};
