import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { call, eventBus } from '$lib/stores/gateway.js';
import { addToast } from '$lib/stores/toast.js';

export interface CronJob {
	id: string;
	name: string;
	description?: string;
	scheduleType: 'cron' | 'interval' | 'one-shot';
	schedule: string;
	enabled: boolean;
	nextRun: number | null;
	lastRun: number | null;
	lastStatus?: 'success' | 'error' | null;
	payloadType?: string;
	sessionTarget?: string;
}

const _jobs: Writable<CronJob[]> = writable([]);
const _isLoading: Writable<boolean> = writable(false);
const _error: Writable<string | null> = writable(null);

export const cronJobs: Readable<CronJob[]> = readonly(_jobs);
export const cronLoading: Readable<boolean> = readonly(_isLoading);
export const cronError: Readable<string | null> = readonly(_error);

let eventUnsub: (() => void) | null = null;

export async function loadCronJobs(): Promise<void> {
	_isLoading.set(true);
	_error.set(null);
	try {
		const result = await call<{ jobs: CronJob[] }>('cron.list', { includeDisabled: true });
		_jobs.set(result.jobs ?? []);
	} catch (err) {
		_error.set((err as Error).message);
		_jobs.set([]);
	} finally {
		_isLoading.set(false);
	}
}

export function subscribeToCronEvents(): void {
	if (eventUnsub) return;
	eventUnsub = eventBus.on('cron', (payload: Record<string, unknown>) => {
		const action = payload.action as string;
		const jobName = (payload.name as string) ?? 'Job';

		if (action === 'ran') {
			const status = payload.status as string;
			if (status === 'error') {
				addToast(`Job "${jobName}" failed`, 'error');
			} else {
				addToast(`Job "${jobName}" completed`, 'success');
			}
		} else if (action === 'created') {
			addToast(`Job "${jobName}" created`, 'info');
		} else if (action === 'deleted') {
			addToast(`Job "${jobName}" deleted`, 'info');
		}

		if (action === 'updated' || action === 'created' || action === 'deleted' || action === 'ran') {
			// Reload the full list on any cron event
			loadCronJobs();
		}
	});
}

export function unsubscribeFromCronEvents(): void {
	if (eventUnsub) {
		eventUnsub();
		eventUnsub = null;
	}
}

export function formatSchedule(job: CronJob): string {
	if (job.scheduleType === 'cron') return job.schedule;
	if (job.scheduleType === 'interval') return `Every ${job.schedule}`;
	if (job.scheduleType === 'one-shot') return 'One-shot';
	return job.schedule;
}

export interface CronJobInput {
	name: string;
	description?: string;
	scheduleType: 'cron' | 'interval' | 'one-shot';
	schedule: string;
	payloadType: 'system-event' | 'agent-turn';
	sessionTarget?: string;
}

export async function createCronJob(input: CronJobInput): Promise<boolean> {
	try {
		await call('cron.create', input as unknown as Record<string, unknown>);
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
		await call('cron.update', { id, patch });
		await loadCronJobs();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function deleteCronJob(id: string): Promise<boolean> {
	try {
		await call('cron.delete', { id });
		await loadCronJobs();
		return true;
	} catch (err) {
		_error.set((err as Error).message);
		return false;
	}
}

export async function runCronJob(id: string): Promise<boolean> {
	try {
		await call('cron.run', { id, mode: 'force' });
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
	status: 'success' | 'error';
	output: string;
	durationMs?: number;
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
		const result = await call<{ runs: CronRun[] }>('cron.runs', { id: jobId, limit: 50 });
		_runs.set(result.runs ?? []);
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
