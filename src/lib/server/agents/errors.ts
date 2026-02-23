import { json } from '@sveltejs/kit';

export const AGENT_ERRORS = {
	NOT_FOUND: 'AGENT_NOT_FOUND',
	CONFLICT: 'AGENT_CONFLICT',
	DUPLICATE: 'AGENT_DUPLICATE',
	INVALID: 'AGENT_INVALID',
	PROTECTED: 'AGENT_PROTECTED'
} as const;

export class AgentError extends Error {
	code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
	}
}

export function handleAgentError(err: unknown): Response {
	if (err instanceof AgentError) {
		switch (err.code) {
			case AGENT_ERRORS.NOT_FOUND:
				return json({ error: err.message, code: err.code }, { status: 404 });
			case AGENT_ERRORS.CONFLICT:
			case AGENT_ERRORS.DUPLICATE:
				return json({ error: err.message, code: err.code }, { status: 409 });
			case AGENT_ERRORS.INVALID:
				return json({ error: err.message, code: err.code }, { status: 400 });
			case AGENT_ERRORS.PROTECTED:
				return json({ error: err.message, code: err.code }, { status: 403 });
			default:
				return json({ error: err.message, code: err.code }, { status: 400 });
		}
	}

	const message = err instanceof Error ? err.message : 'Internal server error';
	return json({ error: message, code: 'AGENT_INTERNAL' }, { status: 500 });
}
