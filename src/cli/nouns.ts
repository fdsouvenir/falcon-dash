import {
	commandMeta,
	WORK3_COMMANDS,
	type Work3CommandMeta
} from '../lib/work3-shared/commands.js';
import { parsePublicId } from '../lib/work3-shared/ids.js';
import { CliError } from './errors.js';
import { parseArgs, type FlagSpec } from './flags.js';
import { apiCommand, apiGet, currentVersion } from './http.js';
import { render, type RenderOptions } from './render.js';

/**
 * Noun/verb command surface (doc 04): object nouns with semantic verbs, list/
 * get/search reads, no generic status patch. Verbs are generated from the
 * shared manifest so CLI and server cannot drift.
 */

const NUMBER_FIELDS = new Set(['due_at', 'follow_up_at']);

/** engine command name → CLI verb, per noun. */
export const NOUN_VERBS: Record<string, Record<string, string>> = {
	area: {
		create: 'create_area',
		update: 'update_area',
		archive: 'archive_area',
		restore: 'restore_area'
	},
	task: {
		create: 'create_task',
		update: 'update_task',
		ready: 'ready_task',
		start: 'start_task',
		wait: 'wait_task',
		resume: 'resume_task',
		submit: 'submit_task_for_review',
		accept: 'accept_task',
		complete: 'complete_task',
		cancel: 'cancel_task',
		reopen: 'reopen_task'
	},
	blocker: {
		create: 'create_blocker',
		resolve: 'resolve_blocker',
		invalidate: 'invalidate_blocker'
	}
};

const LIST_FILTERS: Record<string, string[]> = {
	task: ['status', 'area', 'owner', 'priority', 'active', 'q'],
	area: ['state'],
	blocker: ['state', 'blocked']
};

function outputOptions(
	flags: Record<string, string | number | boolean>,
	fullCommand?: string
): RenderOptions {
	return {
		json: flags.json === true,
		full: flags.full === true,
		fields:
			typeof flags.fields === 'string' ? flags.fields.split(',').map((f) => f.trim()) : undefined,
		fullCommand
	};
}

function payloadSpec(meta: Work3CommandMeta): FlagSpec {
	const spec: FlagSpec = { expect_version: 'number', idempotency_key: 'string' };
	for (const field of [...meta.required, ...meta.optional]) {
		spec[field] = NUMBER_FIELDS.has(field) ? 'number' : 'string';
	}
	return spec;
}

function payloadFromFlags(
	meta: Work3CommandMeta,
	flags: Record<string, string | number | boolean>
): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	for (const field of [...meta.required, ...meta.optional]) {
		if (flags[field] !== undefined) payload[field] = flags[field];
	}
	const missing = meta.required.filter((field) => payload[field] === undefined);
	if (missing.length > 0) {
		throw new CliError(
			'usage',
			`${meta.name} requires: ${missing.map((f) => `--${f.replaceAll('_', '-')}`).join(', ')}`
		);
	}
	return payload;
}

/** One relevant next action after a mutation (doc 04) — never workflow noise. */
function nextAction(
	command: string,
	targetId: string | undefined,
	resultStatus: unknown
): string | undefined {
	if (command === 'create_task') return `falcon task ready ${targetId} --owner <owner>`;
	if (command === 'ready_task') return `falcon task start ${targetId}`;
	if (command === 'start_task') return `falcon task complete ${targetId} --result-summary "…"`;
	if (command === 'submit_task_for_review') return `falcon task accept ${targetId}`;
	if (command === 'create_blocker')
		return `falcon blocker resolve ${targetId} --summary "…" (when cleared)`;
	if (resultStatus === 'waiting') return `falcon task resume ${targetId}`;
	return undefined;
}

async function runVerb(
	noun: string,
	verb: string,
	commandName: string,
	args: string[]
): Promise<string> {
	const meta = commandMeta(commandName);
	if (!meta) throw new CliError('internal_error', `Manifest missing ${commandName}`);
	const { positional, flags } = parseArgs(args, payloadSpec(meta));

	let target: string | undefined;
	let expectedVersion: number | undefined;
	if (meta.target) {
		target = positional[0];
		if (!target) {
			throw new CliError('usage', `Usage: falcon ${noun} ${verb} <id> [flags]`);
		}
		expectedVersion =
			typeof flags.expect_version === 'number'
				? flags.expect_version
				: await currentVersion(meta.target, target);
	}

	const payload = payloadFromFlags(meta, flags);
	const success = await apiCommand({
		command: commandName,
		target,
		expectedVersion,
		idempotencyKey: typeof flags.idempotency_key === 'string' ? flags.idempotency_key : undefined,
		payload
	});

	const result = success.result as Record<string, unknown>;
	const primaryEvent = success.events.find((event) => event.subject_id === (target ?? result.id));
	const output: Record<string, unknown> = {
		command: commandName,
		target: target ?? result.id,
		...result,
		noop: success.noop,
		...(primaryEvent
			? { prior_version: primaryEvent.version_from, version: primaryEvent.version_to }
			: {})
	};
	const next = nextAction(commandName, (target ?? result.id) as string | undefined, result.status);
	if (next) output.next = next;
	return render(output, outputOptions(flags));
}

async function runList(noun: string, args: string[]): Promise<string> {
	const spec: FlagSpec = { limit: 'number', offset: 'number' };
	for (const filter of LIST_FILTERS[noun]) spec[filter] = 'string';
	const { flags } = parseArgs(args, spec);
	const params = new URLSearchParams();
	for (const filter of LIST_FILTERS[noun]) {
		if (flags[filter] !== undefined) params.set(filter, String(flags[filter]));
	}
	if (flags.limit !== undefined) params.set('limit', String(flags.limit));
	if (flags.offset !== undefined) params.set('offset', String(flags.offset));
	const query = params.toString();
	const data = await apiGet(`/api/v3/objects/${noun}${query ? `?${query}` : ''}`);
	return render({ total: data.total, count: data.count, items: data.items }, outputOptions(flags));
}

async function runGet(noun: string, args: string[]): Promise<string> {
	const { positional, flags } = parseArgs(args, {});
	const id = positional[0];
	if (!id) throw new CliError('usage', `Usage: falcon ${noun} get <id> [--full] [--json]`);
	const view = flags.full === true ? 'full' : 'detail';
	const data = await apiGet(`/api/v3/objects/${noun}/${id}?view=${view}`);
	return render(data.item as Record<string, unknown>, {
		...outputOptions(flags, `falcon ${noun} get ${id} --full`)
	});
}

export function nounCommand(noun: string): (args: string[]) => Promise<string> {
	return async (args: string[]) => {
		const verb = args[0];
		if (!verb) {
			throw new CliError('usage', `Usage: falcon ${noun} <verb> …`, {
				suggestions: verbListFor(noun)
			});
		}
		const rest = args.slice(1);
		if (verb === 'list') return runList(noun, rest);
		if (verb === 'get') return runGet(noun, rest);
		const commandName = NOUN_VERBS[noun][verb];
		if (!commandName) {
			throw new CliError('usage', `Unknown verb for ${noun}: ${verb}`, {
				suggestions: verbListFor(noun)
			});
		}
		return runVerb(noun, verb, commandName, rest);
	};
}

export function verbListFor(noun: string): string[] {
	return ['list', 'get', ...Object.keys(NOUN_VERBS[noun])].map((verb) => `falcon ${noun} ${verb}`);
}

/** `falcon work list|get|search` — cross-type conveniences. */
export async function workCommand(args: string[]): Promise<string> {
	const sub = args[0];
	if (sub === 'list') {
		return runList('task', args.slice(1));
	}
	if (sub === 'get') {
		const id = args[1];
		if (!id) throw new CliError('usage', 'Usage: falcon work get <id>');
		const parsed = parsePublicId(id);
		if (!parsed) {
			throw new CliError('validation_failed', `Not a recognizable Work id: ${id}`);
		}
		return runGet(parsed.type, args.slice(1));
	}
	if (sub === 'search') {
		const { positional, flags } = parseArgs(args.slice(1), { limit: 'number' });
		const query = positional.join(' ');
		if (!query) throw new CliError('usage', 'Usage: falcon work search <query>');
		const params = new URLSearchParams({ q: query, active: 'true' });
		if (flags.limit !== undefined) params.set('limit', String(flags.limit));
		const data = await apiGet(`/api/v3/objects/task?${params}`);
		return render(
			{ query, total: data.total, count: data.count, items: data.items },
			outputOptions(flags)
		);
	}
	throw new CliError('usage', 'Usage: falcon work list|get|search', {
		suggestions: [
			'falcon work list --active true',
			'falcon work get t42',
			'falcon work search "deploy"'
		]
	});
}

export function commandHelp(noun: string): string {
	const lines = [`falcon ${noun} — verbs:`, '  list, get'];
	for (const [verb, commandName] of Object.entries(NOUN_VERBS[noun])) {
		const meta = commandMeta(commandName)!;
		const required = meta.required.map((field) => `--${field.replaceAll('_', '-')} <v>`).join(' ');
		const optional =
			meta.optional.length > 0
				? ` [--${meta.optional.map((f) => f.replaceAll('_', '-')).join('|--')}]`
				: '';
		const targetArg = meta.target ? ' <id>' : '';
		lines.push(`  ${verb}${targetArg} ${required}${optional} — ${meta.summary}`);
	}
	lines.push(
		'',
		'Output: TOON by default; --json, --fields a,b, --full. Reads: --status, --area, --q filters on list.'
	);
	return lines.join('\n');
}

export { WORK3_COMMANDS };
