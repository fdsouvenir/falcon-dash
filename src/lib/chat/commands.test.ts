import { describe, it, expect, vi } from 'vitest';
import { commands, filterCommands, parseCommand } from './commands.js';

vi.mock('$lib/stores/gateway.js', () => ({
	call: vi.fn()
}));

describe('filterCommands', () => {
	it('returns all commands when query is empty', () => {
		const result = filterCommands('');
		expect(result).toEqual(commands);
	});

	it('filters commands by partial name match', () => {
		const result = filterCommands('new');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('new');
	});

	it('returns empty array for non-matching query', () => {
		const result = filterCommands('xyz123');
		expect(result).toHaveLength(0);
	});

	it('is case-insensitive', () => {
		const result = filterCommands('NEW');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('new');
	});
});

describe('parseCommand', () => {
	it('returns null for non-slash text', () => {
		const result = parseCommand('hello world');
		expect(result).toBeNull();
	});

	it('returns null for empty slash', () => {
		const result = parseCommand('/');
		expect(result).toBeNull();
	});

	it('parses a known command without args', () => {
		const result = parseCommand('/new');
		expect(result).not.toBeNull();
		expect(result?.command.name).toBe('new');
		expect(result?.args).toBe('');
	});

	it('parses a known command with args', () => {
		const result = parseCommand('/new gpt-4');
		expect(result).not.toBeNull();
		expect(result?.command.name).toBe('new');
		expect(result?.args).toBe('gpt-4');
	});

	it('returns null for unknown command', () => {
		const result = parseCommand('/unknown');
		expect(result).toBeNull();
	});
});
