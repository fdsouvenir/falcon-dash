// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { asTimestamp } from './agent-lifecycle.js';

describe('task ledger timestamps', () => {
	it('normalizes epoch milliseconds and seconds to ISO timestamps', () => {
		expect(asTimestamp(1_750_000_000_000)).toBe('2025-06-15T15:06:40.000Z');
		expect(asTimestamp(1_750_000_000)).toBe('2025-06-15T15:06:40.000Z');
	});
});
