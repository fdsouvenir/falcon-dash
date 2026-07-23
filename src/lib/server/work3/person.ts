import type { RequestEvent } from '@sveltejs/kit';
import type { Actor } from '$lib/work3-shared/types.js';
import type { CommandSuccess } from '$lib/work3-shared/types.js';
import { executeCommand, type CommandInput } from './engine/execute.js';

/**
 * Person adapter (doc 06): person actorship exists ONLY through the operator
 * UI's server-side path — SvelteKit form actions / server routes calling the
 * engine in-process, protected by SvelteKit's origin check. There is no
 * session store and no network API that can mint a person actor.
 */

const PERSON_ID = 'fred';
const DEFAULT_LABEL = 'Fred';

export function personActorFromRequest(event: Pick<RequestEvent, 'request'>): Actor {
	const accessEmail = event.request.headers.get('cf-access-authenticated-user-email');
	return {
		kind: 'person',
		id: PERSON_ID,
		label: accessEmail ?? DEFAULT_LABEL
	};
}

/**
 * Execute a semantic command as the operator. Callers must be in-process
 * SvelteKit server code handling a same-origin operator-UI request; never
 * expose this through a bearer-authenticated route.
 */
export async function executePersonCommand<TResult = unknown>(
	event: Pick<RequestEvent, 'request'>,
	input: Omit<CommandInput, 'actor'>
): Promise<CommandSuccess<TResult>> {
	return executeCommand<TResult>({ ...input, actor: personActorFromRequest(event) });
}
