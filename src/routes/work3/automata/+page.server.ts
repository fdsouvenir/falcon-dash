import type { PageServerLoad } from './$types.js';
import { isWork3Error } from '$lib/work3-shared/errors.js';
import { startWork3 } from '$lib/server/work3/index.js';
import { getObjectReader } from '$lib/server/work3/read/registry.js';

export const load: PageServerLoad = async () => {
	startWork3();
	try {
		const automata = await getObjectReader('automaton').list({
			view: 'list',
			filters: {},
			limit: 100,
			offset: 0
		});
		return { automata: automata.items, runtimeError: null };
	} catch (error) {
		// Runtime unavailability is an operation/health state, not a crash.
		if (isWork3Error(error) && error.code === 'runtime_unavailable') {
			return { automata: [], runtimeError: error.message };
		}
		throw error;
	}
};
