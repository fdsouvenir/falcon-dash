import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { listWorkQueue } from '$lib/server/work/index.js';

export const GET: RequestHandler = async () => {
	const queue = listWorkQueue();
	return json({ queue, sourceOfTruth: 'work' });
};
