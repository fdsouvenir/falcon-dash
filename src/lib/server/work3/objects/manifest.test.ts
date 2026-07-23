// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORK3_COMMANDS } from '$lib/work3-shared/commands.js';
import { getCommand, listCommandNames, registerWork3Objects } from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/**
 * Drift guard (doc 06): the shared command manifest consumed by the CLI must
 * exactly match the server's registered command surface.
 */

let context: Work3TestContext;

beforeEach(() => {
	context = setupWork3TestDbs();
	registerWork3Objects();
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('shared command manifest', () => {
	it('matches the server registry exactly', () => {
		const registered = listCommandNames();
		const manifest = WORK3_COMMANDS.map((command) => command.name).sort();
		expect(manifest).toEqual(registered);
	});

	it('agrees on target types and summaries', () => {
		for (const meta of WORK3_COMMANDS) {
			const definition = getCommand(meta.name);
			expect(definition, meta.name).toBeDefined();
			expect(definition!.targetType, meta.name).toBe(meta.target);
			expect(definition!.summary, meta.name).toBe(meta.summary);
			expect(definition!.requiresTarget, meta.name).toBe(meta.target !== null);
		}
	});
});
