import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { resolveWork3SourceRef, startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { makeCommandAction } from '$lib/server/work3/ui.js';
import type { SourceRef } from '$lib/work3-shared/types.js';

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const finding = await getObjectReader('finding').get(params.id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
	if (!finding) throw httpError(404, `No such finding: ${params.id}`);

	// Resolve sources for the "source unavailable" UI state (doc 03).
	const refs = (finding.source_refs as SourceRef[]) ?? [];
	const resolutions = await Promise.all(refs.map((ref) => resolveWork3SourceRef(ref)));
	return {
		finding,
		sources: refs.map((ref, index) => ({ ...ref, ...resolutions[index] }))
	};
};

export const actions: Actions = {
	command: makeCommandAction('finding')
};
