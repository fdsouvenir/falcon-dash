// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { mapHeartbeatEvent, normalizeHeartbeatHistory } from './heartbeat.js';

describe('protocol v4 heartbeat adapter', () => {
	it('maps the nullable last-heartbeat event shape', () => {
		expect(
			mapHeartbeatEvent({
				ts: 1_784_150_526_355,
				status: 'skipped',
				reason: 'empty-heartbeat-file'
			})
		).toEqual({
			id: 'heartbeat-1784150526355',
			timestamp: 1_784_150_526_355,
			checked: [],
			surfaced: [],
			summary: 'empty-heartbeat-file',
			status: 'skipped'
		});
	});

	it('preserves the protocol v3 history envelope', () => {
		const execution = {
			id: 'legacy-heartbeat',
			timestamp: 1234,
			checked: ['inbox'],
			surfaced: [],
			summary: 'Nothing due',
			status: 'success' as const
		};
		expect(normalizeHeartbeatHistory({ executions: [execution] })).toEqual([execution]);
	});
});
