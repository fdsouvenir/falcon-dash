import { getGatewayClient } from '$lib/server/gateway-client.js';
import { Work3Error } from '$lib/work3-shared/errors.js';

/**
 * Thin cron RPC boundary for the Automaton aggregate. Injectable so contract
 * tests run against a fake runtime.
 *
 * Verified against openclaw 2026.7.1-2 dist: `cron.update` takes {id, patch}
 * — the capability audit's `expectedConfigRevision` does NOT exist in this
 * build, so optimistic concurrency uses the job's updatedAtMs (read → compare
 * → update; the small race window is accepted and recorded in LEARNINGS).
 */

export interface CronJob {
	id: string;
	declarationKey?: string;
	name: string;
	description?: string;
	enabled: boolean;
	agentId?: string;
	sessionKey?: string;
	sessionTarget: string;
	wakeMode: string;
	schedule: Record<string, unknown>;
	payload: Record<string, unknown>;
	delivery?: Record<string, unknown>;
	createdAtMs: number;
	updatedAtMs: number;
	nextRunAtMs?: number;
	lastRunAtMs?: number;
	lastRunStatus?: 'ok' | 'error' | 'skipped';
	lastRunError?: string;
	lastDeliveryStatus?: string;
	state?: Record<string, unknown>;
}

export interface CronRun {
	ts: number;
	jobId: string;
	status?: 'ok' | 'error' | 'skipped';
	error?: string;
	summary?: string;
	runId?: string;
	[key: string]: unknown;
}

export interface CronGatewayApi {
	list(): Promise<CronJob[]>;
	get(id: string): Promise<CronJob | null>;
	add(params: Record<string, unknown>): Promise<CronJob>;
	update(id: string, patch: Record<string, unknown>): Promise<CronJob>;
	remove(id: string): Promise<void>;
	runs(id: string, limit: number): Promise<CronRun[]>;
}

function wrapUnavailable(error: unknown): never {
	throw new Work3Error(
		'runtime_unavailable',
		`OpenClaw gateway operation failed: ${error instanceof Error ? error.message : String(error)}`
	);
}

const liveCronGateway: CronGatewayApi = {
	async list() {
		try {
			const result = await getGatewayClient().call<{ jobs?: CronJob[] } | CronJob[]>('cron.list', {
				includeDisabled: true
			});
			return Array.isArray(result) ? result : (result.jobs ?? []);
		} catch (error) {
			wrapUnavailable(error);
		}
	},
	async get(id) {
		try {
			const result = await getGatewayClient().call<CronJob | { job?: CronJob } | null>('cron.get', {
				id
			});
			if (!result) return null;
			return 'job' in (result as Record<string, unknown>)
				? ((result as { job?: CronJob }).job ?? null)
				: (result as CronJob);
		} catch (error) {
			// A missing id is a gateway error response; treat call failures that
			// mention the id as not-found, transport failures as unavailable.
			if (error instanceof Error && /not found|unknown/i.test(error.message)) return null;
			wrapUnavailable(error);
		}
	},
	async add(params) {
		try {
			const result = await getGatewayClient().call<CronJob | { job: CronJob }>('cron.add', params);
			return 'job' in (result as Record<string, unknown>)
				? (result as { job: CronJob }).job
				: (result as CronJob);
		} catch (error) {
			wrapUnavailable(error);
		}
	},
	async update(id, patch) {
		try {
			return await getGatewayClient().call<CronJob>('cron.update', { id, patch });
		} catch (error) {
			wrapUnavailable(error);
		}
	},
	async remove(id) {
		try {
			await getGatewayClient().call('cron.remove', { id });
		} catch (error) {
			wrapUnavailable(error);
		}
	},
	async runs(id, limit) {
		try {
			const result = await getGatewayClient().call<
				{ entries?: CronRun[]; runs?: CronRun[] } | CronRun[]
			>('cron.runs', { scope: 'job', id, limit });
			if (Array.isArray(result)) return result;
			return result.entries ?? result.runs ?? [];
		} catch (error) {
			wrapUnavailable(error);
		}
	}
};

let cronGateway: CronGatewayApi = liveCronGateway;

export function getCronGateway(): CronGatewayApi {
	return cronGateway;
}

export function setCronGatewayForTests(api: CronGatewayApi | null): void {
	cronGateway = api ?? liveCronGateway;
}
