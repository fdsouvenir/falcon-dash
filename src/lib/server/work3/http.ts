import { json } from '@sveltejs/kit';
import { isWork3Error, WORK3_ERROR_HTTP_STATUS, Work3Error } from '$lib/work3-shared/errors.js';
import type { Actor } from '$lib/work3-shared/types.js';
import { resolveBearerActor } from './auth.js';
import { startWork3 } from './index.js';
import type { ReadOptions, ReadView } from './read/registry.js';

/**
 * HTTP glue for /api/v3: bearer-only actor resolution and the structured-error
 * to HTTP-status mapping. JSON only — TOON rendering is a CLI concern.
 */

/**
 * Resolve the agent actor for a /api/v3 request, or produce the 401 response.
 * By construction this can only ever yield an agent actor (auth.ts).
 */
export function requireAgentActor(request: Request): { actor: Actor } | { response: Response } {
	startWork3();
	const actor = resolveBearerActor(request.headers.get('authorization'));
	if (!actor) {
		return {
			response: json(
				{
					code: 'unauthorized',
					message: 'A valid bearer token is required. Mint one in Settings → Agent Tokens.'
				},
				{ status: 401 }
			)
		};
	}
	return { actor };
}

export function work3ErrorResponse(error: unknown): Response {
	if (isWork3Error(error)) {
		return json(error.toShape(), { status: WORK3_ERROR_HTTP_STATUS[error.code] });
	}
	console.error('[work3] unhandled error in /api/v3:', error);
	const internal = new Work3Error('internal_error', 'Internal error');
	return json(internal.toShape(), { status: 500 });
}

const READ_VIEWS: ReadView[] = ['list', 'detail', 'full'];
const RESERVED_PARAMS = new Set(['view', 'fields', 'limit', 'offset']);

/** Parse ?view/?fields/?limit/?offset; every other query param is a filter. */
export function parseReadOptions(url: URL, defaultView: ReadView): ReadOptions {
	const viewParam = url.searchParams.get('view') ?? defaultView;
	if (!READ_VIEWS.includes(viewParam as ReadView)) {
		throw new Work3Error('validation_failed', `Unknown view: ${viewParam}`, {
			details: { known_views: READ_VIEWS }
		});
	}
	const fieldsParam = url.searchParams.get('fields');
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');
	const limit = limitParam === null ? 50 : Number(limitParam);
	const offset = offsetParam === null ? 0 : Number(offsetParam);
	if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
		throw new Work3Error('validation_failed', 'limit must be an integer between 1 and 200');
	}
	if (!Number.isInteger(offset) || offset < 0) {
		throw new Work3Error('validation_failed', 'offset must be a non-negative integer');
	}
	const filters: Record<string, string> = {};
	for (const [key, value] of url.searchParams) {
		if (!RESERVED_PARAMS.has(key)) filters[key] = value;
	}
	return {
		view: viewParam as ReadView,
		fields: fieldsParam ? fieldsParam.split(',').map((field) => field.trim()) : undefined,
		filters,
		limit,
		offset
	};
}
