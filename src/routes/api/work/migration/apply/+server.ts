import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { applyWorkMigration } from '$lib/server/work/index.js';
import { triggerContextGeneration } from '$lib/server/work/context-scheduler.js';

export const POST: RequestHandler = async () => {
	const preview = applyWorkMigration();
	triggerContextGeneration();
	return json({ ...preview, applied: true, sourceOfTruth: 'work' });
};
