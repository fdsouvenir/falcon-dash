import {
	commandMeta,
	WORK3_COMMANDS,
	type Work3CommandMeta
} from '../lib/work3-shared/commands.js';
import { parsePublicId } from '../lib/work3-shared/ids.js';
import { CliError } from './errors.js';
import { parseArgs, type FlagSpec } from './flags.js';
import { apiCommand, apiGet, apiPost, currentVersion } from './http.js';
import { render, type RenderOptions } from './render.js';

/**
 * Noun/verb command surface (doc 04): object nouns with semantic verbs, list/
 * get/search reads, no generic status patch. Verbs are generated from the
 * shared manifest so CLI and server cannot drift.
 */

const NUMBER_FIELDS = new Set([
	'sequence',
	'due_at',
	'follow_up_at',
	'target_at',
	'needed_by',
	'until',
	'observed_at'
]);

/** Structured payload fields passed as JSON strings on the command line. */
const JSON_FIELDS = new Set([
	'options',
	'deciders',
	'recommendation',
	'answerable_by',
	'working_hypothesis',
	'source_refs',
	'targets',
	'authority_source',
	'steps',
	'plan',
	'conditions',
	'criteria_evidence',
	'comments',
	'scope_allowed',
	'scope_prohibited',
	'risk',
	'safety',
	'acceptance_criteria',
	'one_time',
	'scope_included',
	'scope_excluded',
	'completion_criteria',
	'parallel_phases_allowed',
	'parallel',
	'clear'
]);

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
	},
	question: {
		create: 'create_question',
		update: 'update_question',
		answer: 'answer_question',
		'revise-answer': 'revise_answer',
		withdraw: 'withdraw_question',
		reopen: 'reopen_question'
	},
	decision: {
		create: 'create_decision',
		revise: 'revise_decision',
		decide: 'decide',
		defer: 'defer_decision',
		resume: 'resume_decision',
		withdraw: 'withdraw_decision',
		supersede: 'supersede_decision'
	},
	finding: {
		create: 'create_finding',
		supersede: 'supersede_finding',
		retract: 'retract_finding'
	},
	plan: {
		create: 'create_plan',
		update: 'update_plan',
		submit: 'submit_plan',
		revise: 'revise_plan',
		withdraw: 'withdraw_plan'
	},
	review: {
		create: 'create_review'
	},
	authorization: {
		revoke: 'revoke_authorization'
	},
	project: {
		create: 'create_project',
		update: 'update_project',
		plan: 'plan_project',
		activate: 'activate_project',
		pause: 'pause_project',
		complete: 'complete_project',
		cancel: 'cancel_project',
		reopen: 'reopen_project',
		archive: 'archive_project',
		restore: 'restore_project',
		'set-next': 'set_current_next_item',
		'waive-criterion': 'waive_completion_criterion',
		'health-override': 'set_project_health_override'
	},
	phase: {
		create: 'create_phase',
		activate: 'activate_phase',
		complete: 'complete_phase',
		skip: 'skip_phase',
		reopen: 'reopen_phase'
	},
	milestone: {
		create: 'create_milestone',
		achieve: 'achieve_milestone',
		cancel: 'cancel_milestone',
		reopen: 'reopen_milestone'
	},
	link: {
		create: 'link_work',
		remove: 'unlink_work',
		assign: 'assign_to_project'
	},
	change: {
		create: 'create_change',
		revise: 'revise_change',
		authorize: 'authorize_change',
		start: 'start_change',
		pause: 'pause_change',
		resume: 'resume_change',
		succeed: 'succeed_execution',
		fail: 'fail_execution',
		retry: 'retry_change',
		cancel: 'cancel_change',
		'start-verification': 'start_verification',
		'pass-verification': 'pass_verification',
		'fail-verification': 'fail_verification',
		'waive-verification': 'waive_verification',
		'start-rollback': 'start_rollback',
		'complete-rollback': 'complete_rollback'
	}
};

const LIST_FILTERS: Record<string, string[]> = {
	task: ['status', 'area', 'owner', 'priority', 'active', 'q'],
	area: ['state'],
	blocker: ['state', 'blocked'],
	question: ['status', 'area', 'steward', 'priority'],
	decision: ['status', 'area', 'priority'],
	finding: ['validity', 'confidence', 'area', 'target'],
	plan: ['work_item'],
	review: ['subject', 'outcome'],
	authorization: ['subject'],
	change: ['execution', 'verification', 'area'],
	project: ['status', 'area', 'archived'],
	phase: ['project', 'status'],
	milestone: ['project', 'status']
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
		if (flags[field] === undefined) continue;
		if (JSON_FIELDS.has(field)) {
			try {
				payload[field] = JSON.parse(String(flags[field]));
			} catch {
				throw new CliError('usage', `--${field.replaceAll('_', '-')} must be valid JSON`, {
					suggestions: [`Example: --${field.replaceAll('_', '-')} '["value"]'`]
				});
			}
		} else {
			payload[field] = flags[field];
		}
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
		if (verb === 'list' && LIST_FILTERS[noun]) return runList(noun, rest);
		if (verb === 'get' && LIST_FILTERS[noun]) return runGet(noun, rest);
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

/** `falcon history <id>` — Event Log timeline for one object. */
export async function historyCommand(args: string[]): Promise<string> {
	const { positional, flags } = parseArgs(args, { limit: 'number', event_type: 'string' });
	const subject = positional[0];
	if (!subject)
		throw new CliError('usage', 'Usage: falcon history <id> [--limit N] [--event-type type]');
	const params = new URLSearchParams({ subject });
	if (flags.limit !== undefined) params.set('limit', String(flags.limit));
	if (flags.event_type !== undefined) params.set('event_type', String(flags.event_type));
	const data = await apiGet(`/api/v3/history?${params}`);
	const events = (data.events as Record<string, unknown>[]).map((event) => ({
		at: event.occurred_at,
		event: event.event_type,
		summary: event.summary,
		actor: (event.actor as Record<string, unknown>)?.label,
		version: event.version_to
	}));
	return render({ subject, count: data.count, events }, outputOptions(flags));
}

/** `falcon sources check --kind message --ref sessionKey#msgId` — resolve one ref. */
export async function sourcesCommand(args: string[]): Promise<string> {
	if (args[0] !== 'check') {
		throw new CliError(
			'usage',
			'Usage: falcon sources check --kind <kind> --ref <ref> [--label …] [--locator …]'
		);
	}
	const { flags } = parseArgs(args.slice(1), {
		kind: 'string',
		ref: 'string',
		label: 'string',
		locator: 'string'
	});
	if (!flags.kind || !flags.ref) {
		throw new CliError('usage', 'sources check requires --kind and --ref');
	}
	const body = {
		source_refs: [
			{
				kind: flags.kind,
				ref: flags.ref,
				...(flags.label ? { label: flags.label } : {}),
				...(flags.locator ? { locator: flags.locator } : {})
			}
		]
	};
	const data = await apiPost('/api/v3/sources/resolve', body);
	return render({ results: data.results }, outputOptions(flags));
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
