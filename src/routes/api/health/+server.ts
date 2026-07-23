import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pkg from '../../../../package.json';
import { getWork3OutboxDiagnostics } from '$lib/server/work3/index.js';

const startTime = Date.now();

export const GET: RequestHandler = async () => {
	// Outbox transfer lag and failed Event Log publication are observable
	// operational states, never silent (doc 01 Event Log rules, gate 6).
	let work3: Record<string, unknown>;
	try {
		const outbox = getWork3OutboxDiagnostics();
		const degraded =
			outbox.last_error !== null ||
			(outbox.oldest_pending_age_ms !== null && outbox.oldest_pending_age_ms > 60_000);
		work3 = { status: degraded ? 'degraded' : 'ok', outbox };
	} catch (error) {
		work3 = { status: 'error', error: error instanceof Error ? error.message : String(error) };
	}

	return json({
		status: 'ok',
		version: pkg.version,
		uptime: Math.floor((Date.now() - startTime) / 1000),
		work3
	});
};
