import { writable, readonly, type Readable, type Writable } from 'svelte/store';
import { call, eventBus } from '$lib/stores/gateway.js';

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
