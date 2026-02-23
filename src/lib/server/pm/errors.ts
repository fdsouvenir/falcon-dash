import { json } from '@sveltejs/kit';
import { PMError, PM_ERRORS } from './validation.js';

/**
 * Map PMError codes to HTTP responses.
 * For non-PMError exceptions, returns a generic 500.
 */
export function handlePMError(err: unknown): Response {
	if (err instanceof PMError) {
		switch (err.code) {
			case PM_ERRORS.PM_NOT_FOUND:
				return json({ error: err.message, code: err.code }, { status: 404 });
			case PM_ERRORS.PM_CONSTRAINT:
				return json({ error: err.message, code: err.code }, { status: 400 });
			case PM_ERRORS.PM_DUPLICATE:
				return json({ error: err.message, code: err.code }, { status: 409 });
			default:
				return json({ error: err.message, code: err.code }, { status: 400 });
		}
	}

	const message = err instanceof Error ? err.message : 'Internal server error';
	return json({ error: message, code: 'PM_INTERNAL' }, { status: 500 });
}
