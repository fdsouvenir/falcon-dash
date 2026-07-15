import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { rpc, gatewayEvents, gatewaySupportsMethod } from '$lib/gateway-api.js';
import { addToast } from '$lib/stores/toast.js';
import { notifyCron } from '$lib/stores/notifications.js';

export interface CronJob {
	id: string;
	name: string;
	description?: string;
	scheduleType: 'cron' | 'interval' | 'one-shot';
	schedule: string;
	rawSchedule?: Record<string, unknown>;
	rawPayload?: Record<string, unknown>;
	enabled: boolean;
	nextRun: number | null;
	lastRun: number | null;
	lastStatus?: 'success' | 'error' | 'skipped' | null;
	payloadType?: 'system-event' | 'agent-turn' | 'command';
	sessionTarget?: string;
	sessionKey?: string;
}

type GatewayCronSchedule =
	| { kind: 'cron'; expr: string; tz?: string; staggerMs?: number }
	| { kind: 'every'; everyMs: number; anchorMs?: number }
	| { kind: 'at'; at: string };

interface GatewayCronJob {
	id: string;
	name: string;
	description?: string;
	enabled: boolean;
	schedule: GatewayCronSchedule;
	payload:
		| { kind: 'systemEvent'; text: string }
		| ({ kind: 'agentTurn'; message: string } & Record<string, unknown>)
		| ({ kind: 'command'; argv: string[] } & Record<string, unknown>);
	sessionTarget: string;
	sessionKey?: string;
	state?: {
		nextRunAtMs?: number;
		lastRunAtMs?: number;
		lastRunStatus?: 'ok' | 'error' | 'skipped';
		lastStatus?: 'ok' | 'error' | 'skipped';
	};
}

const _jobs: Writable<CronJob[]> = writable([]);
const _isLoading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);

export const cronJobs: Readable<CronJob[]> = readonly(_jobs);
export const cronLoading: Readable<boolean> = readonly(_isLoading);
export const cronError: Readable<string | null> = readonly(_error);

let eventUnsub: (() => void) | null = null;

export interface NormalizedCronEvent {
	action: 'added' | 'updated' | 'removed' | 'started' | 'finished' | 'scheduled' | 'unknown';
	jobName: string;
	status?: string;
	shouldReload: boolean;
}

/** Normalize protocol v3 and v4 cron lifecycle event shapes. */
export function normalizeCronEvent(payload: Record<string, unknown>): NormalizedCronEvent {
	const aliases: Record<string, NormalizedCronEvent['action']> = {
		created: 'added',
		deleted: 'removed',
		ran: 'finished',
		added: 'added',
		updated: 'updated',
		removed: 'removed',
		started: 'started',
		finished: 'finished',
		scheduled: 'scheduled'
	};
	const action = aliases[String(payload.action ?? '')] ?? 'unknown';
	const nestedJob =
		payload.job && typeof payload.job === 'object'
			? (payload.job as Record<string, unknown>)
			: undefined;
	return {
		action,
		jobName:
			(typeof nestedJob?.name === 'string' ? nestedJob.name : undefined) ??
			(typeof payload.name === 'string' ? payload.name : 'Job'),
		status: typeof payload.status === 'string' ? payload.status : undefined,
		shouldReload: action !== 'unknown'
	};
}

export async function loadCronJobs(): Promise<void> {
	_isLoading.set(true);
	_error.set(null);
	try {
		const supportsPagination = await gatewaySupportsMethod('cron.add');
		if (!supportsPagination) {
			const result = await rpc<{ jobs: Array<GatewayCronJob | CronJob> }>('cron.list', {
				includeDisabled: true
			});
			_jobs.set((result.jobs ?? []).map(mapGatewayCronJob));
			return;
		}

		const jobs: CronJob[] = [];
		let offset = 0;
		while (true) {
			const result = await rpc<{
				jobs: Array<GatewayCronJob | CronJob>;
				hasMore?: boolean;
				nextOffset?: number | null;
			}>('cron.list', { includeDisabled: true, offset, limit: 200 });
			jobs.push(...(result.jobs ?? []).map(mapGatewayCronJob));
			if (!result.hasMore || typeof result.nextOffset !== 'number' || result.nextOffset <= offset)
				break;
			offset = result.nextOffset;
		}
		_jobs.set(jobs);
	} catch (err) {
		_error.set((err as Error).message);
		_jobs.set([]);
	} finally {
		_isLoading.set(false);
	}
}

export function subscribeToCronEvents(): void {
	if (eventUnsub) return;
	eventUnsub = gatewayEvents.on('cron', (payload: Record<string, unknown>) => {
		const event = normalizeCronEvent(payload);

		if (event.action === 'finished') {
			if (event.status === 'error') {
				addToast(`Job "${event.jobName}" failed`, 'error');
				notifyCron(event.jobName, 'Job failed');
			} else if (event.status === 'skipped') {
				addToast(`Job "${event.jobName}" skipped`, 'info');
			} else {
				addToast(`Job "${event.jobName}" completed`, 'success');
				notifyCron(event.jobName, 'Job completed successfully');
			}
		} else if (event.action === 'added') {
			addToast(`Job "${event.jobName}" created`, 'info');
		} else if (event.action === 'removed') {
			addToast(`Job "${event.jobName}" deleted`, 'info');
		}

		if (event.shouldReload) loadCronJobs();
	});
}

export function unsubscribeFromCronEvents(): void {
	if (eventUnsub) {
		eventUnsub();
		eventUnsub = null;
	}
}

/** Coerce a schedule value (may be object from gateway) to a displayable string. */
export function normalizeSchedule(schedule: unknown): string {
	if (typeof schedule === 'string') return schedule;
	if (schedule && typeof schedule === 'object') {
		const rec = schedule as Record<string, unknown>;
		if (typeof rec.expr === 'string') return rec.expr;
		if (typeof rec.expression === 'string') return rec.expression;
		if (typeof rec.everyMs === 'number') return `${rec.everyMs}ms`;
		if (typeof rec.at === 'string') return rec.at;
		return JSON.stringify(schedule);
	}
	return String(schedule ?? '');
}

export function mapGatewayCronJob(job: GatewayCronJob | CronJob): CronJob {
	if (!job.schedule || typeof job.schedule !== 'object' || !('kind' in job.schedule)) {
		const legacy = job as CronJob;
		return {
			...legacy,
			rawSchedule:
				typeof legacy.schedule === 'object'
					? (legacy.schedule as unknown as Record<string, unknown>)
					: legacy.rawSchedule,
			schedule: normalizeSchedule(legacy.schedule)
		};
	}
	const gatewayJob = job as GatewayCronJob;
	const status = gatewayJob.state?.lastRunStatus ?? gatewayJob.state?.lastStatus ?? null;
	return {
		id: gatewayJob.id,
		name: gatewayJob.name,
		description: gatewayJob.description,
		scheduleType:
			gatewayJob.schedule.kind === 'every'
				? 'interval'
				: gatewayJob.schedule.kind === 'at'
					? 'one-shot'
					: 'cron',
		schedule: normalizeSchedule(gatewayJob.schedule),
		rawSchedule: gatewayJob.schedule as unknown as Record<string, unknown>,
		rawPayload: gatewayJob.payload as unknown as Record<string, unknown>,
		enabled: gatewayJob.enabled,
		nextRun: gatewayJob.state?.nextRunAtMs ?? null,
		lastRun: gatewayJob.state?.lastRunAtMs ?? null,
		lastStatus: status === 'ok' ? 'success' : status,
		payloadType:
			gatewayJob.payload.kind === 'systemEvent'
				? 'system-event'
				: gatewayJob.payload.kind === 'agentTurn'
					? 'agent-turn'
					: 'command',
		sessionTarget: gatewayJob.sessionTarget,
		sessionKey: gatewayJob.sessionKey
	};
}

export function formatSchedule(job: CronJob): string {
	const sched = normalizeSchedule(job.schedule);
	if (job.scheduleType === 'cron') return sched;
	if (job.scheduleType === 'interval') return `Every ${sched}`;
	if (job.scheduleType === 'one-shot') return 'One-shot';
	return sched;
}

export interface CronJobInput {
	name: string;
	description?: string;
	scheduleType: 'cron' | 'interval' | 'one-shot';
	schedule: string;
	payloadType: 'system-event' | 'agent-turn' | 'command';
	sessionTarget?: string;
	sessionKey?: string;
	existingSchedule?: Record<string, unknown>;
	existingPayload?: Record<string, unknown>;
}

/**
 * Map the form's CronJobInput to the gateway protocol v4 `cron.add` shape.
 * v4 replaced the flat `{scheduleType, schedule(string), payloadType}` with a
 * discriminated `schedule` object and a `payload` body.
 */
export function parseIntervalMs(value: string): number {
	const trimmed = value.trim().toLowerCase();
	const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/.exec(trimmed);
	if (!match) throw new Error('Interval must be a duration such as 30s, 5m, 1h, or 1d');
	const amount = Number(match[1]);
	const multipliers: Record<string, number> = {
		ms: 1,
		s: 1000,
		m: 60_000,
		h: 3_600_000,
		d: 86_400_000
	};
	const milliseconds = Math.round(amount * multipliers[match[2] ?? 'ms']);
	if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
		throw new Error('Interval must resolve to a positive whole number of milliseconds');
	}
	return milliseconds;
}

function toGatewaySchedule(
	scheduleType: CronJobInput['scheduleType'],
	value: string,
	existing?: Record<string, unknown>
): GatewayCronSchedule {
	if (scheduleType === 'interval') {
		return {
			kind: 'every',
			everyMs: parseIntervalMs(value),
			...(existing?.kind === 'every' && typeof existing.anchorMs === 'number'
				? { anchorMs: existing.anchorMs }
				: {})
		};
	}
	if (scheduleType === 'one-shot') return { kind: 'at', at: value };
	return {
		kind: 'cron',
		expr: value,
		...(existing?.kind === 'cron' && typeof existing.tz === 'string' ? { tz: existing.tz } : {}),
		...(existing?.kind === 'cron' && typeof existing.staggerMs === 'number'
			? { staggerMs: existing.staggerMs }
			: {})
	};
}

function cronBody(input: Pick<CronJobInput, 'name' | 'description'>): string {
	return input.description?.trim() || input.name.trim();
}

function sessionTargetFor(
	payloadType: CronJobInput['payloadType'],
	requested: string | undefined,
	sessionKey?: string
): string {
	const target = requested?.trim() || (payloadType === 'system-event' ? 'main' : 'isolated');
	if (payloadType === 'system-event' && target !== 'main') {
		throw new Error('System Event jobs must use the main session target');
	}
	if (
		payloadType !== 'system-event' &&
		target !== 'isolated' &&
		target !== 'current' &&
		!(target.startsWith('session:') && target.length > 'session:'.length && !target.includes('\0'))
	) {
		throw new Error(
			'Agent Turn and Command jobs require isolated, current, or session:<id> as the target'
		);
	}
	if (target === 'current' && !sessionKey?.trim()) {
		throw new Error('Current-session jobs require an existing bound session key');
	}
	return target;
}

function toGatewayPayload(input: CronJobInput): Record<string, unknown> {
	const existingKind = input.existingPayload?.kind;
	const expectedKind =
		input.payloadType === 'system-event'
			? 'systemEvent'
			: input.payloadType === 'agent-turn'
				? 'agentTurn'
				: 'command';
	if (existingKind === expectedKind) return { ...input.existingPayload };
	if (input.payloadType === 'command') {
		throw new Error('Command payloads can only be preserved from an existing command job');
	}
	const body = cronBody(input);
	return input.payloadType === 'agent-turn'
		? { kind: 'agentTurn', message: body }
		: { kind: 'systemEvent', text: body };
}

export function toCronAddParams(input: CronJobInput): Record<string, unknown> {
	const schedule = toGatewaySchedule(input.scheduleType, input.schedule, input.existingSchedule);
	const sessionTarget = sessionTargetFor(input.payloadType, input.sessionTarget, input.sessionKey);

	// The form has no dedicated payload-body field; use the description (or name)
	// as the system-event text / agent-turn message.
	return {
		name: input.name,
		description: input.description,
		sessionTarget,
		...(sessionTarget === 'current' ? { sessionKey: input.sessionKey?.trim() } : {}),
		wakeMode: 'next-heartbeat',
		schedule,
		payload: toGatewayPayload(input)
	};
}

export function toCronUpdatePatch(
	patch: Partial<CronJobInput & { enabled: boolean }>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const field of ['name', 'description', 'enabled'] as const) {
		if (patch[field] !== undefined) result[field] = patch[field];
	}
	if (patch.schedule !== undefined || patch.scheduleType !== undefined) {
		if (patch.schedule === undefined || patch.scheduleType === undefined) {
			throw new Error('Schedule updates require both scheduleType and schedule');
		}
		result.schedule = toGatewaySchedule(patch.scheduleType, patch.schedule, patch.existingSchedule);
	}
	if (patch.payloadType !== undefined) {
		if (!patch.name?.trim()) throw new Error('Payload updates require the job name');
		const input = patch as CronJobInput;
		result.payload = toGatewayPayload(input);
		const sessionTarget = sessionTargetFor(
			patch.payloadType,
			patch.sessionTarget,
			patch.sessionKey
		);
		result.sessionTarget = sessionTarget;
		if (sessionTarget === 'current') result.sessionKey = patch.sessionKey?.trim();
	} else if (patch.sessionTarget !== undefined) {
		throw new Error('Session target updates require payloadType');
	}
	return result;
}

export async function createCronJob(input: CronJobInput): Promise<boolean> {
	try {
		if (await gatewaySupportsMethod('cron.add')) {
			await rpc('cron.add', toCronAddParams(input));
		} else {
			await rpc('cron.create', input as unknown as Record<string, unknown>);
		}
		await loadCronJobs();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function updateCronJob(
	id: string,
	patch: Partial<CronJobInput & { enabled: boolean }>
): Promise<boolean> {
	try {
		const usesNestedPatch = await gatewaySupportsMethod('cron.add');
		await rpc('cron.update', {
			id,
			patch: usesNestedPatch ? toCronUpdatePatch(patch) : patch
		});
		await loadCronJobs();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function deleteCronJob(id: string): Promise<boolean> {
	try {
		await rpc((await gatewaySupportsMethod('cron.remove')) ? 'cron.remove' : 'cron.delete', { id });
		await loadCronJobs();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function runCronJob(id: string): Promise<boolean> {
	try {
		await rpc('cron.run', { id, mode: 'force' });
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function toggleCronJob(id: string, enabled: boolean): Promise<boolean> {
	return updateCronJob(id, { enabled });
}

export interface CronRun {
	id: string;
	jobId: string;
	timestamp: number;
	status: 'success' | 'error' | 'skipped';
	output: string;
	durationMs?: number;
}

interface GatewayCronRunEntry {
	ts: number;
	jobId: string;
	runId?: string;
	runAtMs?: number;
	status?: 'ok' | 'error' | 'skipped';
	summary?: string;
	error?: string;
	durationMs?: number;
}

export function mapGatewayCronRun(entry: GatewayCronRunEntry): CronRun {
	const status: CronRun['status'] =
		entry.status === 'ok'
			? 'success'
			: entry.status === 'error' || (!entry.status && entry.error)
				? 'error'
				: (entry.status ?? 'success');
	return {
		id: entry.runId ?? `${entry.jobId}:${entry.ts}`,
		jobId: entry.jobId,
		timestamp: entry.runAtMs ?? entry.ts,
		status,
		output: status === 'error' ? (entry.error ?? entry.summary ?? '') : (entry.summary ?? ''),
		durationMs: entry.durationMs
	};
}

const _runs: Writable<CronRun[]> = writable([]);
const _runsLoading: Writable<boolean> = writable(false);
const _selectedJobId: Writable<string | null> = writable(null);

export const cronRuns: Readable<CronRun[]> = readonly(_runs);
export const cronRunsLoading: Readable<boolean> = readonly(_runsLoading);
export const selectedJobId: Readable<string | null> = readonly(_selectedJobId);

export async function loadCronRuns(jobId: string): Promise<void> {
	_selectedJobId.set(jobId);
	_runsLoading.set(true);
	try {
		const result = await rpc<{ entries?: GatewayCronRunEntry[]; runs?: CronRun[] }>('cron.runs', {
			id: jobId,
			limit: 50
		});
		_runs.set(result.entries ? result.entries.map(mapGatewayCronRun) : (result.runs ?? []));
	} catch (err) {
		_error.set((err as Error).message);
		_runs.set([]);
	} finally {
		_runsLoading.set(false);
	}
}

export function clearCronRuns(): void {
	_selectedJobId.set(null);
	_runs.set([]);
}
