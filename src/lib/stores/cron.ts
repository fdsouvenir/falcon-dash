import { writable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import type {
	CronAddParams,
	CronEditParams,
	CronJob,
	CronListResponse,
	CronRun,
	CronRunsResponse
} from '$lib/gateway/types';

/** All cron jobs */
export const cronJobs = writable<CronJob[]>([]);

/** Run history for the currently viewed job */
export const cronRuns = writable<CronRun[]>([]);

// --- Cron CRUD ---

/** Load all cron jobs from the gateway */
export async function loadCronJobs(): Promise<void> {
	const response = await gateway.call<CronListResponse>('cron.list');
	cronJobs.set(response.jobs);
}

/** Add a new cron job */
export async function addCronJob(params: CronAddParams): Promise<void> {
	await gateway.call('cron.add', params as unknown as Record<string, unknown>);
	await loadCronJobs();
}

/** Edit an existing cron job */
export async function editCronJob(params: CronEditParams): Promise<void> {
	await gateway.call('cron.edit', params as unknown as Record<string, unknown>);
	await loadCronJobs();
}

/** Remove a cron job */
export async function removeCronJob(jobId: string): Promise<void> {
	await gateway.call('cron.rm', { jobId });
	cronJobs.update((jobs) => jobs.filter((j) => j.id !== jobId));
}

/** Enable a cron job */
export async function enableCronJob(jobId: string): Promise<void> {
	await gateway.call('cron.enable', { jobId });
	cronJobs.update((jobs) => jobs.map((j) => (j.id === jobId ? { ...j, enabled: true } : j)));
}

/** Disable a cron job */
export async function disableCronJob(jobId: string): Promise<void> {
	await gateway.call('cron.disable', { jobId });
	cronJobs.update((jobs) => jobs.map((j) => (j.id === jobId ? { ...j, enabled: false } : j)));
}

/** Trigger an immediate run of a cron job */
export async function runCronJob(jobId: string): Promise<void> {
	await gateway.call('cron.run', { jobId });
}

/** Load run history for a specific job */
export async function loadCronRuns(jobId: string): Promise<void> {
	const response = await gateway.call<CronRunsResponse>('cron.runs', { jobId });
	cronRuns.set(response.runs);
}

// --- Real-time Event Listeners ---

let unsubscribeFns: (() => void)[] = [];

/** Handle incoming cron events to keep store in sync */
function handleCronEvent(payload: unknown): void {
	const event = payload as Record<string, unknown>;
	const action = event.action as string;

	if (action === 'added' || action === 'updated') {
		const job = event.job as CronJob;
		cronJobs.update((jobs) => {
			const idx = jobs.findIndex((j) => j.id === job.id);
			if (idx >= 0) {
				const updated = [...jobs];
				updated[idx] = job;
				return updated;
			}
			return [...jobs, job];
		});
	} else if (action === 'removed') {
		const jobId = event.jobId as string;
		cronJobs.update((jobs) => jobs.filter((j) => j.id !== jobId));
	} else if (action === 'run_update') {
		const run = event.run as CronRun;
		cronRuns.update((runs) => {
			const idx = runs.findIndex((r) => r.id === run.id);
			if (idx >= 0) {
				const updated = [...runs];
				updated[idx] = run;
				return updated;
			}
			return [run, ...runs];
		});
	}
}

/** Wire up gateway cron event listeners */
export function initCronListeners(): void {
	destroyCronListeners();
	unsubscribeFns.push(gateway.on('cron', handleCronEvent));
}

/** Clean up cron event listeners */
export function destroyCronListeners(): void {
	unsubscribeFns.forEach((fn) => fn());
	unsubscribeFns = [];
}
