// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { formatDate, isWorkDateOverdue, scheduleDateForItem } from './work-ui.js';

describe('Work date presentation', () => {
	it('compares date-only deadlines as local calendar dates', () => {
		const midday = new Date(2026, 6, 15, 12, 0, 0);

		expect(isWorkDateOverdue('2026-07-14', midday)).toBe(true);
		expect(isWorkDateOverdue('2026-07-15', midday)).toBe(false);
		expect(isWorkDateOverdue('2026-07-16', midday)).toBe(false);
		expect(formatDate('2026-07-15', 'en-US', midday)).toBe('Jul 15');
	});

	it('compares timestamp schedules against the current instant', () => {
		const midday = new Date(2026, 6, 15, 12, 0, 0);
		const morning = new Date(2026, 6, 15, 9, 0, 0).valueOf() / 1000;
		const afternoon = new Date(2026, 6, 15, 15, 0, 0).valueOf() / 1000;

		expect(isWorkDateOverdue(morning, midday)).toBe(true);
		expect(isWorkDateOverdue(afternoon, midday)).toBe(false);
	});

	it('rejects invalid dates', () => {
		expect(isWorkDateOverdue('not-a-date', new Date(2026, 6, 15, 12, 0, 0))).toBe(false);
		expect(isWorkDateOverdue('2026-99-99', new Date(2026, 6, 15, 12, 0, 0))).toBe(false);
	});

	it('prefers the authoritative next run for automations', () => {
		expect(
			scheduleDateForItem({
				type: 'automation',
				due_date: null,
				target_date: null,
				scheduled_at: '2026-07-14',
				next_run_at: 1_784_157_600,
				stale_after: null
			})
		).toBe(1_784_157_600);
	});
});
