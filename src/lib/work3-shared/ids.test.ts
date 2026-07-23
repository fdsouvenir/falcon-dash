import { describe, expect, it } from 'vitest';
import { formatPublicId, parsePublicId, WORK3_TYPE_PREFIXES } from './ids.js';

describe('work3 public ids', () => {
	it('round-trips every type prefix', () => {
		for (const type of Object.keys(WORK3_TYPE_PREFIXES) as Array<
			keyof typeof WORK3_TYPE_PREFIXES
		>) {
			const id = formatPublicId(type, 42);
			expect(parsePublicId(id)).toEqual({ type, seq: 42 });
		}
	});

	it('disambiguates multi-letter prefixes', () => {
		expect(parsePublicId('p3')).toEqual({ type: 'project', seq: 3 });
		expect(parsePublicId('ph3')).toEqual({ type: 'phase', seq: 3 });
		expect(parsePublicId('pl3')).toEqual({ type: 'plan', seq: 3 });
	});

	it('rejects malformed ids', () => {
		expect(parsePublicId('t0')).toBeNull();
		expect(parsePublicId('x7')).toBeNull();
		expect(parsePublicId('t')).toBeNull();
		expect(parsePublicId('42')).toBeNull();
		expect(parsePublicId('T42')).toBeNull();
	});
});
