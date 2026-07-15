// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
	mapGatewayCronJob,
	mapGatewayCronRun,
	normalizeCronEvent,
	parseIntervalMs,
	toCronAddParams,
	toCronUpdatePatch
} from './cron.js';

describe('protocol v4 cron adapters', () => {
	it('normalizes v4 and legacy lifecycle events', () => {
		expect(
			normalizeCronEvent({
				action: 'finished',
				job: { id: 'job-1', name: 'Sweep' },
				status: 'error'
			})
		).toEqual({ action: 'finished', jobName: 'Sweep', status: 'error', shouldReload: true });
		expect(normalizeCronEvent({ action: 'created', name: 'Legacy job' })).toEqual({
			action: 'added',
			jobName: 'Legacy job',
			status: undefined,
			shouldReload: true
		});
	});

	it('normalizes nested jobs and run history', () => {
		expect(
			mapGatewayCronJob({
				id: 'job-1',
				name: 'Sweep',
				enabled: true,
				schedule: { kind: 'every', everyMs: 300_000 },
				payload: { kind: 'agentTurn', message: 'Review stale work' },
				sessionTarget: 'isolated',
				state: {
					nextRunAtMs: 1_800_000_000_000,
					lastRunAtMs: 1_799_999_700_000,
					lastRunStatus: 'skipped'
				}
			})
		).toMatchObject({
			scheduleType: 'interval',
			schedule: '300000ms',
			payloadType: 'agent-turn',
			sessionTarget: 'isolated',
			nextRun: 1_800_000_000_000,
			lastRun: 1_799_999_700_000,
			lastStatus: 'skipped'
		});

		expect(
			mapGatewayCronRun({
				ts: 1_799_999_700_000,
				jobId: 'job-1',
				runId: 'run-1',
				status: 'ok',
				summary: 'Completed',
				durationMs: 250
			})
		).toEqual({
			id: 'run-1',
			jobId: 'job-1',
			timestamp: 1_799_999_700_000,
			status: 'success',
			output: 'Completed',
			durationMs: 250
		});
	});

	it('infers status-less legacy run outcomes from their error payload', () => {
		expect(
			mapGatewayCronRun({
				ts: 1000,
				jobId: 'legacy-success',
				summary: 'Completed'
			})
		).toMatchObject({ status: 'success', output: 'Completed' });
		expect(
			mapGatewayCronRun({
				ts: 2000,
				jobId: 'legacy-error',
				summary: 'Partial output',
				error: 'Failed'
			})
		).toMatchObject({ status: 'error', output: 'Failed' });
	});

	it('preserves already-flat protocol v3 jobs', () => {
		expect(
			mapGatewayCronJob({
				id: 'legacy-1',
				name: 'Legacy sweep',
				scheduleType: 'cron',
				schedule: '0 7 * * *',
				enabled: true,
				nextRun: 1000,
				lastRun: 500,
				payloadType: 'system-event',
				sessionTarget: 'main'
			})
		).toMatchObject({
			id: 'legacy-1',
			schedule: '0 7 * * *',
			payloadType: 'system-event'
		});
	});

	it('preserves payload details and schedule metadata while editing', () => {
		const existingPayload = {
			kind: 'agentTurn',
			message: 'Original instruction',
			model: 'openai/gpt-5'
		};
		expect(
			toCronUpdatePatch({
				name: 'Renamed job',
				description: 'Display-only description',
				scheduleType: 'cron',
				schedule: '0 8 * * *',
				payloadType: 'agent-turn',
				sessionTarget: 'isolated',
				existingSchedule: {
					kind: 'cron',
					expr: '0 7 * * *',
					tz: 'America/Chicago',
					staggerMs: 30_000
				},
				existingPayload
			})
		).toMatchObject({
			schedule: {
				kind: 'cron',
				expr: '0 8 * * *',
				tz: 'America/Chicago',
				staggerMs: 30_000
			},
			payload: existingPayload
		});

		expect(
			toCronUpdatePatch({
				scheduleType: 'interval',
				schedule: '10m',
				existingSchedule: { kind: 'every', everyMs: 300_000, anchorMs: 1234 }
			})
		).toEqual({ schedule: { kind: 'every', everyMs: 600_000, anchorMs: 1234 } });
	});

	it('parses duration strings and emits nested create/update shapes', () => {
		expect(parseIntervalMs('5m')).toBe(300_000);
		expect(parseIntervalMs('1.5h')).toBe(5_400_000);
		expect(() => parseIntervalMs('five minutes')).toThrow(/duration/);

		const input = {
			name: 'Sweep',
			description: 'Review stale work',
			scheduleType: 'interval' as const,
			schedule: '5m',
			payloadType: 'agent-turn' as const
		};
		expect(toCronAddParams(input)).toMatchObject({
			sessionTarget: 'isolated',
			schedule: { kind: 'every', everyMs: 300_000 },
			payload: { kind: 'agentTurn', message: 'Review stale work' }
		});
		expect(toCronUpdatePatch({ ...input, enabled: false })).toEqual({
			name: 'Sweep',
			description: 'Review stale work',
			enabled: false,
			schedule: { kind: 'every', everyMs: 300_000 },
			payload: { kind: 'agentTurn', message: 'Review stale work' },
			sessionTarget: 'isolated'
		});
	});

	it('rejects incompatible session targets', () => {
		expect(() =>
			toCronAddParams({
				name: 'Agent job',
				scheduleType: 'cron',
				schedule: '0 * * * *',
				payloadType: 'agent-turn',
				sessionTarget: 'main'
			})
		).toThrow(/require isolated/);

		expect(
			toCronAddParams({
				name: 'Named session job',
				scheduleType: 'cron',
				schedule: '0 * * * *',
				payloadType: 'agent-turn',
				sessionTarget: 'session:ops+alerts@example/team'
			})
		).toMatchObject({ sessionTarget: 'session:ops+alerts@example/team' });

		expect(() =>
			toCronAddParams({
				name: 'Unbound current job',
				scheduleType: 'cron',
				schedule: '0 * * * *',
				payloadType: 'agent-turn',
				sessionTarget: 'current'
			})
		).toThrow(/bound session key/);
		expect(
			toCronAddParams({
				name: 'Bound current job',
				scheduleType: 'cron',
				schedule: '0 * * * *',
				payloadType: 'agent-turn',
				sessionTarget: 'current',
				sessionKey: 'agent:main:ops'
			})
		).toMatchObject({ sessionTarget: 'current', sessionKey: 'agent:main:ops' });
	});
});
