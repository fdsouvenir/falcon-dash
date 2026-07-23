import { Work3Error } from '$lib/work3-shared/errors.js';

/** Small payload-shape helpers; throw validation_failed with field context. */

export function requireString(
	payload: Record<string, unknown>,
	field: string,
	options: { maxLength?: number } = {}
): string {
	const value = payload[field];
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Work3Error('validation_failed', `${field} is required`, {
			details: { field }
		});
	}
	if (options.maxLength && value.length > options.maxLength) {
		throw new Work3Error('validation_failed', `${field} exceeds ${options.maxLength} characters`, {
			details: { field }
		});
	}
	return value.trim();
}

export function optionalString(
	payload: Record<string, unknown>,
	field: string
): string | undefined {
	const value = payload[field];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') {
		throw new Work3Error('validation_failed', `${field} must be a string`, {
			details: { field }
		});
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? undefined : trimmed;
}

export function optionalEnum<T extends string>(
	payload: Record<string, unknown>,
	field: string,
	allowed: readonly T[]
): T | undefined {
	const value = optionalString(payload, field);
	if (value === undefined) return undefined;
	if (!(allowed as readonly string[]).includes(value)) {
		throw new Work3Error('validation_failed', `${field} must be one of: ${allowed.join(', ')}`, {
			details: { field, allowed: [...allowed] }
		});
	}
	return value as T;
}

export function requireEnum<T extends string>(
	payload: Record<string, unknown>,
	field: string,
	allowed: readonly T[]
): T {
	const value = requireString(payload, field);
	if (!(allowed as readonly string[]).includes(value)) {
		throw new Work3Error('validation_failed', `${field} must be one of: ${allowed.join(', ')}`, {
			details: { field, allowed: [...allowed] }
		});
	}
	return value as T;
}

export function optionalNumber(
	payload: Record<string, unknown>,
	field: string
): number | undefined {
	const value = payload[field];
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Work3Error('validation_failed', `${field} must be a number`, {
			details: { field }
		});
	}
	return value;
}
