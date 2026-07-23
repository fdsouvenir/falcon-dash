import { Work3Error } from '$lib/work3-shared/errors.js';

/**
 * Read-side object registry for GET /api/v3/objects/[type] (doc 06). Object
 * types register their projections here; the registry enforces the AXI read
 * contract uniformly: loud failure on unknown types, fields, and filters;
 * definitive empty results; bounded lists.
 */

export type ReadView = 'list' | 'detail' | 'full';

export interface ReadOptions {
	view: ReadView;
	/** Narrow the projection to these fields (validated against known fields). */
	fields?: string[];
	filters: Record<string, string>;
	limit: number;
	offset: number;
}

export interface ObjectReadDefinition {
	type: string;
	aliases?: string[];
	/** Every field any view can produce; unknown ?fields= entries fail loudly. */
	knownFields: string[];
	/** Filter keys accepted by list(); unknown filters fail loudly. */
	knownFilters: string[];
	list: (options: ReadOptions) => { items: Record<string, unknown>[]; total: number };
	get: (id: string, options: ReadOptions) => Record<string, unknown> | null;
}

const readers = new Map<string, ObjectReadDefinition>();
const aliasIndex = new Map<string, string>();

export function registerObjectReader(definition: ObjectReadDefinition): void {
	if (readers.has(definition.type)) {
		throw new Error(`work3 object reader registered twice: ${definition.type}`);
	}
	readers.set(definition.type, definition);
	for (const alias of definition.aliases ?? []) {
		aliasIndex.set(alias, definition.type);
	}
}

export function listObjectTypes(): string[] {
	return [...readers.keys()].sort();
}

export function getObjectReader(typeOrAlias: string): ObjectReadDefinition {
	const reader = readers.get(typeOrAlias) ?? readers.get(aliasIndex.get(typeOrAlias) ?? '');
	if (!reader) {
		throw new Work3Error('not_found', `Unknown object type: ${typeOrAlias}`, {
			alternatives: listObjectTypes()
		});
	}
	return reader;
}

export function validateReadOptions(reader: ObjectReadDefinition, options: ReadOptions): void {
	for (const field of options.fields ?? []) {
		if (!reader.knownFields.includes(field)) {
			throw new Work3Error('validation_failed', `Unknown field for ${reader.type}: ${field}`, {
				details: { known_fields: reader.knownFields }
			});
		}
	}
	for (const key of Object.keys(options.filters)) {
		if (!reader.knownFilters.includes(key)) {
			throw new Work3Error('validation_failed', `Unknown filter for ${reader.type}: ${key}`, {
				details: { known_filters: reader.knownFilters }
			});
		}
	}
}

/** Project an item down to the requested fields (id is always kept). */
export function projectFields(
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

/** Test-only. */
export function resetObjectReadersForTests(): void {
	readers.clear();
	aliasIndex.clear();
}
