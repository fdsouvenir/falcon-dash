import { describe, expect, it } from 'vitest';
import { formDateToEpoch } from './ui.js';

describe('Work UI form dates', () => {
	it('preserves browser-normalized epochs and explicit timezone timestamps', () => {
		expect(formDateToEpoch('1784820600000')).toBe(1784820600000);
		expect(formDateToEpoch('2026-07-23T10:30:00Z')).toBe(Date.parse('2026-07-23T10:30:00Z'));
	});

	it('rejects offsetless wall-clock values at the server boundary', () => {
		expect(formDateToEpoch('2026-01-23T10:30')).toBeNaN();
		expect(formDateToEpoch('2026-01-23T10:30:00.000')).toBeNaN();
		expect(formDateToEpoch('07/23/2026 10:30')).toBeNaN();
	});

	it('rejects invalid or out-of-range epochs', () => {
		expect(formDateToEpoch('9999999999999999')).toBeNaN();
		expect(formDateToEpoch('2026-99-99T10:30:00Z')).toBeNaN();
	});
});
