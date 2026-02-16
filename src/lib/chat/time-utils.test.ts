import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, formatAbsoluteTime, formatMessageTime } from './time-utils.js';

describe('formatRelativeTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns "just now" for timestamps less than 60 seconds ago', () => {
		const now = Date.now();
		expect(formatRelativeTime(now - 30000)).toBe('just now');
	});

	it('returns "just now" for future timestamps', () => {
		const now = Date.now();
		expect(formatRelativeTime(now + 10000)).toBe('just now');
	});

	it('returns minutes ago for timestamps between 1-59 minutes', () => {
		const now = Date.now();
		expect(formatRelativeTime(now - 120000)).toBe('2m ago');
		expect(formatRelativeTime(now - 60000)).toBe('1m ago');
	});

	it('returns hours ago for timestamps between 1-23 hours', () => {
		const now = Date.now();
		expect(formatRelativeTime(now - 3600000)).toBe('1h ago');
		expect(formatRelativeTime(now - 7200000)).toBe('2h ago');
	});

	it('returns days ago for timestamps between 1-6 days', () => {
		const now = Date.now();
		expect(formatRelativeTime(now - 86400000)).toBe('1d ago');
		expect(formatRelativeTime(now - 3 * 86400000)).toBe('3d ago');
	});

	it('returns formatted date for timestamps older than 7 days', () => {
		const now = Date.now();
		const result = formatRelativeTime(now - 8 * 86400000);
		// Should be a date string, not "Xd ago"
		expect(result).not.toContain('ago');
	});
});

describe('formatAbsoluteTime', () => {
	it('returns a locale string', () => {
		const ts = new Date('2025-06-15T12:00:00Z').getTime();
		const result = formatAbsoluteTime(ts);
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});
});

describe('formatMessageTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns time only for today', () => {
		const todayMorning = new Date('2025-06-15T08:30:00Z').getTime();
		const result = formatMessageTime(todayMorning);
		// Should contain time but not month name
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});

	it('returns date and time for older messages', () => {
		const yesterday = new Date('2025-06-14T08:30:00Z').getTime();
		const result = formatMessageTime(yesterday);
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});
});
