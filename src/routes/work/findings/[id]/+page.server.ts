import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { resolveWork3SourceRefs, startWork3 } from '$lib/server/work3/index.js';
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
	const { resolutions, omitted } = await resolveWork3SourceRefs(refs);
	return {
		finding,
		sources: refs.slice(0, resolutions.length).map((ref, index) => ({
			...ref,
			...resolutions[index]
		})),
		sourcesOmitted: omitted
	};
};

export const actions: Actions = {
	command: makeCommandAction('finding')
};
