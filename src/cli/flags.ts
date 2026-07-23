import { CliError } from './errors.js';

/**
 * Minimal strict flag parser. Unknown flags fail loudly (doc 04). Flags are
 * kebab-case on the command line and map to snake_case payload fields.
 */

export interface FlagSpec {
	/** snake_case name → kind. Kebab-case aliases are derived automatically. */
	[name: string]: 'string' | 'boolean' | 'number';
}

export interface ParsedArgs {
	positional: string[];
	flags: Record<string, string | number | boolean>;
}

/** Global output flags every command accepts. */
export const OUTPUT_FLAGS: FlagSpec = {
	json: 'boolean',
	full: 'boolean',
	fields: 'string'
};

function toSnake(flag: string): string {
	return flag.replaceAll('-', '_');
}

export function parseArgs(args: string[], spec: FlagSpec): ParsedArgs {
	const merged: FlagSpec = { ...OUTPUT_FLAGS, ...spec };
	const positional: string[] = [];
	const flags: Record<string, string | number | boolean> = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg.startsWith('--')) {
			positional.push(arg);
			continue;
		}
		const body = arg.slice(2);
		const equals = body.indexOf('=');
		const rawName = equals === -1 ? body : body.slice(0, equals);
		const name = toSnake(rawName);
		const kind = merged[name];
		if (!kind) {
			throw new CliError('usage', `Unknown flag: --${rawName}`, {
				suggestions: Object.keys(merged).map((known) => `--${known.replaceAll('_', '-')}`)
			});
		}
		let value: string | undefined;
		if (equals !== -1) {
			value = body.slice(equals + 1);
		} else if (kind !== 'boolean') {
			value = args[i + 1];
			if (value === undefined || value.startsWith('--')) {
				throw new CliError('usage', `Flag --${rawName} requires a value`);
			}
			i++;
		}
		if (kind === 'boolean') {
			flags[name] = value === undefined ? true : value === 'true';
		} else if (kind === 'number') {
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) {
				throw new CliError('usage', `Flag --${rawName} must be a number`);
			}
			flags[name] = parsed;
		} else {
			flags[name] = value as string;
		}
	}
	return { positional, flags };
}
