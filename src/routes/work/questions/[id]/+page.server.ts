import { error as httpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { resolveWork3SourceRefs, startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';
import { makeCommandAction } from '$lib/server/work3/ui.js';
import type { SourceRef } from '$lib/work3-shared/types.js';

export const load: PageServerLoad = async ({ params }) => {
	startWork3();
	const question = await getObjectReader('question').get(params.id, {
		view: 'full',
		filters: {},
		limit: 1,
		offset: 0
	});
	if (!question) throw httpError(404, `No such question: ${params.id}`);
	const answer = question.answer as { source_refs?: SourceRef[] } | null | undefined;
	const refs = answer?.source_refs ?? [];
	const { resolutions, omitted } = await resolveWork3SourceRefs(refs);
	return {
		question,
		answerSources: refs.slice(0, resolutions.length).map((ref, index) => ({
			...ref,
			...resolutions[index]
		})),
		answerSourcesOmitted: omitted
	};
};

export const actions: Actions = {
	command: makeCommandAction('question')
};
