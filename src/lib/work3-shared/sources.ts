import { Work3Error } from './errors.js';
import type { SourceRef } from './types.js';

/** Source-ref shape validation (doc 03). Shared by engine and CLI. */

export function parseSourceRef(raw: unknown): SourceRef {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Work3Error('validation_failed', 'Each source_ref must be an object');
	}
	const candidate = raw as Record<string, unknown>;
	if (typeof candidate.kind !== 'string' || candidate.kind.trim().length === 0) {
		throw new Work3Error('validation_failed', 'source_ref.kind is required');
	}
	if (typeof candidate.ref !== 'string' || candidate.ref.trim().length === 0) {
		throw new Work3Error('validation_failed', 'source_ref.ref is required');
	}
	for (const field of ['label', 'locator', 'snapshot_ref', 'content_hash'] as const) {
		if (candidate[field] !== undefined && typeof candidate[field] !== 'string') {
			throw new Work3Error('validation_failed', `source_ref.${field} must be a string`);
		}
	}
	if (candidate.captured_at !== undefined && typeof candidate.captured_at !== 'number') {
		throw new Work3Error('validation_failed', 'source_ref.captured_at must be a number (ms)');
	}
	return {
		kind: candidate.kind.trim(),
		ref: candidate.ref.trim(),
		...(candidate.label !== undefined ? { label: candidate.label as string } : {}),
		...(candidate.captured_at !== undefined
			? { captured_at: candidate.captured_at as number }
			: {}),
		...(candidate.locator !== undefined ? { locator: candidate.locator as string } : {}),
		...(candidate.snapshot_ref !== undefined
			? { snapshot_ref: candidate.snapshot_ref as string }
			: {}),
		...(candidate.content_hash !== undefined
			? { content_hash: candidate.content_hash as string }
			: {})
	};
}

export function parseSourceRefs(raw: unknown, options: { required?: boolean } = {}): SourceRef[] {
	if (raw === undefined || raw === null) {
		if (options.required) {
			throw new Work3Error('validation_failed', 'source_refs are required');
		}
		return [];
	}
	if (!Array.isArray(raw)) {
		throw new Work3Error('validation_failed', 'source_refs must be an array');
	}
	if (options.required && raw.length === 0) {
		throw new Work3Error('validation_failed', 'source_refs must not be empty');
	}
	return raw.map(parseSourceRef);
}
