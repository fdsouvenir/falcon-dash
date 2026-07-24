import type { PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { searchWork, startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';

const BROWSE_TYPES = [
	'task',
	'question',
	'decision',
	'finding',
	'project',
	'change_request',
	'area'
] as const;

type BrowseType = (typeof BROWSE_TYPES)[number];

function isBrowseType(value: string): value is BrowseType {
	return BROWSE_TYPES.includes(value as BrowseType);
}

async function listType(type: BrowseType): Promise<Array<Record<string, unknown>>> {
	const result = await getObjectReader(type).list({
		view: 'list',
		filters: type === 'project' ? { archived: 'all' } : {},
		limit: 200,
		offset: 0
	});
	return result.items.map((item) => ({ ...item, __type: type }));
}

/** Browse (doc 05): search + filter across existing Work, including terminal. */
export const load: PageServerLoad = async ({ url }) => {
	startWork3();
	const query = url.searchParams.get('q') ?? '';
	const requestedType = url.searchParams.get('type') ?? '';
	const focus = url.searchParams.get('focus');
	let searchError: string | null = null;

	if (requestedType && !isBrowseType(requestedType)) {
		return {
			query,
			type: requestedType,
			focus,
			results: [],
			searchError: `Unknown Browse type: ${requestedType}`,
			items: [],
			now: Date.now()
		};
	}

	const type = requestedType as BrowseType | '';
	let results: Array<Record<string, unknown>> = [];
	if (query) {
		try {
			results = searchWork(query, { type: type || undefined, limit: 50 });
		} catch (error) {
			// Unsupported fields fail visibly, never silently (doc 05).
			if (isWork3Error(error)) searchError = error.message;
			else throw error;
		}
	}

	const items = type
		? await listType(type)
		: (await Promise.all(BROWSE_TYPES.map((candidate) => listType(candidate)))).flat();

	return {
		query,
		type,
		focus,
		results,
		searchError,
		items,
		now: Date.now()
	};
};
