import { Work3Error } from './errors.js';
import type { SourceRef } from './types.js';

/** Source-ref shape validation (doc 03). Shared by engine and CLI. */

export const MAX_SOURCE_REFS = 50;
const MAX_SOURCE_KIND_LENGTH = 64;
const MAX_SOURCE_REF_LENGTH = 4096;
const MAX_SOURCE_METADATA_LENGTH = 8192;

export function parseSourceRef(raw: unknown): SourceRef {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Work3Error('validation_failed', 'Each source_ref must be an object');
	}
	const candidate = raw as Record<string, unknown>;
	if (typeof candidate.kind !== 'string' || candidate.kind.trim().length === 0) {
		throw new Work3Error('validation_failed', 'source_ref.kind is required');
	}
	if (candidate.kind.trim().length > MAX_SOURCE_KIND_LENGTH) {
		throw new Work3Error(
			'validation_failed',
			`source_ref.kind must be at most ${MAX_SOURCE_KIND_LENGTH} characters`
		);
	}
	if (typeof candidate.ref !== 'string' || candidate.ref.trim().length === 0) {
		throw new Work3Error('validation_failed', 'source_ref.ref is required');
	}
	if (candidate.ref.trim().length > MAX_SOURCE_REF_LENGTH) {
		throw new Work3Error(
			'validation_failed',
			`source_ref.ref must be at most ${MAX_SOURCE_REF_LENGTH} characters`
		);
	}
	for (const field of ['label', 'locator', 'snapshot_ref', 'content_hash'] as const) {
		if (candidate[field] !== undefined && typeof candidate[field] !== 'string') {
			throw new Work3Error('validation_failed', `source_ref.${field} must be a string`);
		}
		if (
			typeof candidate[field] === 'string' &&
			candidate[field].length > MAX_SOURCE_METADATA_LENGTH
		) {
			throw new Work3Error(
				'validation_failed',
				`source_ref.${field} must be at most ${MAX_SOURCE_METADATA_LENGTH} characters`
			);
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
	if (raw.length > MAX_SOURCE_REFS) {
		throw new Work3Error(
			'validation_failed',
			`source_refs must contain at most ${MAX_SOURCE_REFS} references`
		);
	}
	return raw.map(parseSourceRef);
}
