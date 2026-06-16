import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getFalconDashModules } from '$lib/server/work/index.js';

export const GET: RequestHandler = async () => {
	return json({
		plugin: 'falcon-dash',
		modules: getFalconDashModules()
	});
};
