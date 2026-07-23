// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	getObjectReader,
	projectFields,
	registerObjectReader,
	validateReadOptions,
	type ReadOptions
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

let context: Work3TestContext;

function options(overrides: Partial<ReadOptions> = {}): ReadOptions {
	return { view: 'list', filters: {}, limit: 50, offset: 0, ...overrides };
}

beforeEach(() => {
	context = setupWork3TestDbs();
	registerObjectReader({
		type: 'task',
		aliases: ['tasks'],
		knownFields: ['id', 'title', 'status'],
		knownFilters: ['status'],
		list: () => ({ items: [{ id: 't1', title: 'A', status: 'ready', secret: 'x' }], total: 1 }),
		get: (id) => (id === 't1' ? { id: 't1', title: 'A', status: 'ready' } : null)
	});
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('object read registry', () => {
	it('resolves types and aliases, and fails loudly on unknown types', () => {
		expect(getObjectReader('task').type).toBe('task');
		expect(getObjectReader('tasks').type).toBe('task');
		expect(() => getObjectReader('widget')).toThrowError(
			expect.objectContaining({ code: 'not_found', alternatives: ['task'] })
		);
	});

	it('fails loudly on unknown fields and filters (AXI)', () => {
		const reader = getObjectReader('task');
		expect(() => validateReadOptions(reader, options({ fields: ['title', 'bogus'] }))).toThrowError(
			expect.objectContaining({ code: 'validation_failed' })
		);
		expect(() => validateReadOptions(reader, options({ filters: { owner: 'fred' } }))).toThrowError(
			expect.objectContaining({ code: 'validation_failed' })
		);
		expect(() =>
			validateReadOptions(reader, options({ fields: ['title'], filters: { status: 'ready' } }))
		).not.toThrow();
	});

	it('projects items down to requested fields, always keeping id', () => {
		const item = { id: 't1', title: 'A', status: 'ready', extra: 1 };
		expect(projectFields(item, ['title'])).toEqual({ id: 't1', title: 'A' });
		expect(projectFields(item, undefined)).toEqual(item);
	});
});
