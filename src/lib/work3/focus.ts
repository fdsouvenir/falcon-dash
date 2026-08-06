import { isAgentIdentity } from '$lib/work3-shared/identity.js';

export type FocusType = 'task' | 'project' | 'change_request' | 'finding';
export type FocusItem = Record<string, unknown>;

interface FocusDefinitionBase {
	type: FocusType;
	key: string;
	label: string;
	description: string;
}

export type FocusDefinition =
	| (FocusDefinitionBase & {
			serverFilter: { field: string; value: string };
			clientPredicate?: never;
	  })
	| (FocusDefinitionBase & {
			serverFilter?: never;
			clientPredicate: (item: FocusItem, now: number) => boolean;
	  });

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_TASK_STATUSES = new Set(['backlog', 'ready', 'in_progress', 'waiting', 'in_review']);
const OPEN_PROJECT_STATUSES = new Set(['draft', 'planned', 'active', 'paused']);

function value(item: FocusItem, field: string): string | null {
	const candidate = item[field];
	return typeof candidate === 'string' ? candidate : null;
}

function epoch(item: FocusItem, field: string): number | null {
	const candidate = item[field];
	return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

function openTask(item: FocusItem): boolean {
	return OPEN_TASK_STATUSES.has(value(item, 'status') ?? '');
}

function openProject(item: FocusItem): boolean {
	return !item.archived && OPEN_PROJECT_STATUSES.has(value(item, 'status') ?? '');
}

export const WORK_FOCUS_DEFINITIONS: FocusDefinition[] = [
	{
		type: 'task',
		key: 'overdue',
		label: 'Overdue',
		description: 'Open tasks whose due date has passed.',
		clientPredicate: (item, now) => {
			const dueAt = epoch(item, 'due_at');
			return openTask(item) && dueAt !== null && dueAt < now;
		}
	},
	{
		type: 'task',
		key: 'blocked',
		label: 'Blocked',
		description: 'Tasks with an active Blocker.',
		clientPredicate: (item) =>
			value(item, 'actionability') === 'blocked' || Boolean(item.blocker_summary)
	},
	{
		type: 'task',
		key: 'waiting-on-you',
		label: 'Waiting on you',
		description: 'Tasks waiting on a person or external dependency, not another agent.',
		clientPredicate: (item) =>
			value(item, 'status') === 'waiting' && !isAgentIdentity(value(item, 'waiting_on'))
	},
	{
		type: 'task',
		key: 'in-review',
		label: 'In review',
		description: 'Task output awaiting human review.',
		serverFilter: { field: 'status', value: 'in_review' }
	},
	{
		type: 'task',
		key: 'ready',
		label: 'Ready',
		description: 'Tasks ready for an agent to start.',
		clientPredicate: (item) =>
			value(item, 'status') === 'ready' && value(item, 'actionability') === 'actionable'
	},
	{
		type: 'project',
		key: 'blocked',
		label: 'Blocked',
		description: 'Projects whose server-derived health is blocked.',
		clientPredicate: (item) => openProject(item) && value(item, 'health') === 'blocked'
	},
	{
		type: 'project',
		key: 'at-risk',
		label: 'At risk',
		description: 'Projects whose server-derived health needs attention.',
		clientPredicate: (item) => openProject(item) && value(item, 'health') === 'at_risk'
	},
	{
		type: 'project',
		key: 'no-next-move',
		label: 'Needs next',
		description: 'Active projects without a valid next move.',
		clientPredicate: (item) =>
			value(item, 'status') === 'active' && item.current_next_valid !== true
	},
	{
		type: 'project',
		key: 'overdue',
		label: 'Overdue',
		description: 'Open Projects whose target date has passed.',
		clientPredicate: (item, now) => {
			const targetAt = epoch(item, 'target_at');
			return openProject(item) && targetAt !== null && targetAt < now;
		}
	},
	{
		type: 'project',
		key: 'stale',
		label: 'Stale',
		description: 'Open Projects with no update in the last 14 days.',
		clientPredicate: (item, now) => {
			const updatedAt = epoch(item, 'updated_at');
			return openProject(item) && updatedAt !== null && updatedAt < now - 14 * DAY_MS;
		}
	},
	{
		type: 'change_request',
		key: 'needs-authorization',
		label: 'Needs authorization',
		description: 'Executable Changes without a valid Authorization.',
		clientPredicate: (item) => {
			const execution = value(item, 'execution_state');
			const authorization = item.authorization as { state?: unknown } | undefined;
			return (
				['not_started', 'paused', 'failed'].includes(execution ?? '') &&
				authorization?.state !== 'valid'
			);
		}
	},
	{
		type: 'change_request',
		key: 'verification-pending',
		label: 'Verification pending',
		description: 'Succeeded execution still awaiting a verification result.',
		clientPredicate: (item) =>
			value(item, 'execution_state') === 'succeeded' &&
			!['passed', 'waived'].includes(value(item, 'verification_state') ?? '')
	},
	{
		type: 'change_request',
		key: 'failed',
		label: 'Failed',
		description: 'Changes with failed execution or verification.',
		clientPredicate: (item) =>
			value(item, 'execution_state') === 'failed' || value(item, 'verification_state') === 'failed'
	},
	{
		type: 'finding',
		key: 'current',
		label: 'Current',
		description: 'Findings that remain current.',
		serverFilter: { field: 'validity', value: 'current' }
	},
	{
		type: 'finding',
		key: 'superseded',
		label: 'Superseded',
		description: 'Findings replaced by a newer conclusion.',
		serverFilter: { field: 'validity', value: 'superseded' }
	},
	{
		type: 'finding',
		key: 'retracted',
		label: 'Retracted',
		description: 'Findings explicitly retracted from use.',
		serverFilter: { field: 'validity', value: 'retracted' }
	}
];

export function focusDefinitionsForType(type: string): FocusDefinition[] {
	return WORK_FOCUS_DEFINITIONS.filter((definition) => definition.type === type);
}

export function focusDefinition(
	type: string,
	key: string | null | undefined
): FocusDefinition | null {
	if (!key) return null;
	return (
		WORK_FOCUS_DEFINITIONS.find(
			(definition) => definition.type === type && definition.key === key
		) ?? null
	);
}

export function matchesFocus(
	item: FocusItem,
	type: string,
	key: string | null | undefined,
	now = Date.now()
): boolean {
	const definition = focusDefinition(type, key);
	if (!definition) return true;
	if (definition.serverFilter) {
		return String(item[definition.serverFilter.field] ?? '') === definition.serverFilter.value;
	}
	return definition.clientPredicate(item, now);
}

export function filterByFocus(
	items: FocusItem[],
	type: string,
	key: string | null | undefined,
	now = Date.now()
): FocusItem[] {
	return items.filter((item) => matchesFocus(item, type, key, now));
}

export function focusCounts(
	items: FocusItem[],
	type: string,
	now = Date.now()
): Record<string, number> {
	return Object.fromEntries(
		focusDefinitionsForType(type).map((definition) => [
			definition.key,
			items.filter((item) => matchesFocus(item, type, definition.key, now)).length
		])
	);
}

export function isTerminalBrowseItem(type: string, item: FocusItem): boolean {
	if (type === 'task') return ['completed', 'cancelled'].includes(value(item, 'status') ?? '');
	if (type === 'question') return ['answered', 'withdrawn'].includes(value(item, 'status') ?? '');
	if (type === 'decision') return ['decided', 'withdrawn'].includes(value(item, 'status') ?? '');
	if (type === 'finding') return value(item, 'validity') !== 'current';
	if (type === 'project') {
		return (
			Boolean(item.archived) || ['completed', 'cancelled'].includes(value(item, 'status') ?? '')
		);
	}
	if (type === 'change_request') {
		if (['cancelled', 'rolled_back'].includes(value(item, 'execution_state') ?? '')) return true;
		return (
			value(item, 'execution_state') === 'succeeded' &&
			['passed', 'waived'].includes(value(item, 'verification_state') ?? '')
		);
	}
	if (type === 'area') return value(item, 'state') === 'archived';
	return false;
}
