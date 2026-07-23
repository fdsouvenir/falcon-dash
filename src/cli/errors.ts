import {
	WORK3_ERROR_EXIT_CLASS,
	type Work3ErrorCode,
	type Work3ErrorShape
} from '../lib/work3-shared/errors.js';

/**
 * CLI errors carry the same stable codes as the server plus CLI-transport
 * codes, and map onto the shared exit classes (doc 04: stable nonzero exit
 * classes; internal HTTP transport stays JSON).
 */

export type CliErrorCode = Work3ErrorCode | 'usage' | 'unauthorized' | 'network';

const CLI_EXIT_CLASS: Record<string, number> = {
	...WORK3_ERROR_EXIT_CLASS,
	usage: 2,
	unauthorized: 6,
	network: 7
};

export class CliError extends Error {
	readonly code: CliErrorCode;
	readonly details: Record<string, unknown>;
	readonly suggestions: string[];

	constructor(
		code: CliErrorCode,
		message: string,
		options: { details?: Record<string, unknown>; suggestions?: string[] } = {}
	) {
		super(message);
		this.name = 'CliError';
		this.code = code;
		this.details = options.details ?? {};
		this.suggestions = options.suggestions ?? [];
	}

	get exitCode(): number {
		return CLI_EXIT_CLASS[this.code] ?? 1;
	}
}

export function cliErrorFromShape(shape: Work3ErrorShape): CliError {
	return new CliError(shape.code, shape.message, {
		details: shape.details,
		suggestions: shape.alternatives?.map((name) => `Valid: ${name}`) ?? []
	});
}

export function exitCodeFor(error: unknown): number {
	return error instanceof CliError ? error.exitCode : 1;
}
