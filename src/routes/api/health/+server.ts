import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pkg from '../../../../package.json';

const startTime = Date.now();

export const GET: RequestHandler = async () => {
	return json({
		status: 'ok',
		version: pkg.version,
		uptime: Math.floor((Date.now() - startTime) / 1000)
	});
};
