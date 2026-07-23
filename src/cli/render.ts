import { encode } from '@toon-format/toon';

/**
 * Output rendering (doc 04): TOON by default, `--json` as the structured
 * escape hatch, `--fields` narrowing, truncation metadata with the exact
 * full-content command. TOON and JSON render the same projection object, so
 * the two modes are semantically equivalent by construction.
 */

export interface RenderOptions {
	json?: boolean;
	full?: boolean;
	fields?: string[];
	/** Exact command that returns complete content, shown on truncation. */
	fullCommand?: string;
}

const TRUNCATE_AT = 500;

export function projectItem(
	item: Record<string, unknown>,
	fields: string[] | undefined
): Record<string, unknown> {
	if (!fields || fields.length === 0) return item;
	const projected: Record<string, unknown> = {};
	for (const field of ['id', ...fields]) {
		if (field in item) projected[field] = item[field];
	}
	return projected;
}

interface TruncationNote {
	field: string;
	original_chars: number;
	shown_chars: number;
}

function truncateStrings(value: unknown, path: string, notes: TruncationNote[]): unknown {
	if (typeof value === 'string' && value.length > TRUNCATE_AT) {
		notes.push({ field: path, original_chars: value.length, shown_chars: TRUNCATE_AT });
		return value.slice(0, TRUNCATE_AT) + '…';
	}
	if (Array.isArray(value)) {
		return value.map((entry, index) => truncateStrings(entry, `${path}[${index}]`, notes));
	}
	if (value !== null && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
			out[key] = truncateStrings(entry, path ? `${path}.${key}` : key, notes);
		}
		return out;
	}
	return value;
}

/**
 * Prepare a payload for output: apply field narrowing and (unless --full)
 * truncate long content, attaching `truncated` metadata and the exact
 * full-content command.
 */
export function preparePayload(
	payload: Record<string, unknown>,
	options: RenderOptions
): Record<string, unknown> {
	let prepared = payload;
	if (options.fields?.length) {
		if (Array.isArray(prepared.items)) {
			prepared = {
				...prepared,
				items: (prepared.items as Record<string, unknown>[]).map((item) =>
					projectItem(item, options.fields)
				)
			};
		} else {
			prepared = projectItem(prepared, options.fields);
		}
	}
	if (!options.full) {
		const notes: TruncationNote[] = [];
		prepared = truncateStrings(prepared, '', notes) as Record<string, unknown>;
		if (notes.length > 0) {
			prepared = {
				...prepared,
				truncated: notes,
				...(options.fullCommand ? { full_content: `Run \`${options.fullCommand}\`` } : {})
			};
		}
	}
	return prepared;
}

export function render(payload: Record<string, unknown>, options: RenderOptions = {}): string {
	const prepared = preparePayload(payload, options);
	if (options.json) return JSON.stringify(prepared, null, 2);
	return encode(prepared);
}
