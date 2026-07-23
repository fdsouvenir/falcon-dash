// @vitest-environment node

import { decode } from '@toon-format/toon';
import { describe, expect, it } from 'vitest';
import { CliError, cliErrorFromShape, exitCodeFor } from './errors.js';
import { parseArgs } from './flags.js';
import { preparePayload, render } from './render.js';

/**
 * AXI release-gate evidence (#336, gate 1 AXI portion): TOON/JSON semantic
 * equivalence, truncation/full behavior, loud unknown-input failures, stable
 * error codes and exit classes.
 */

const sample = {
	total: 2,
	count: 2,
	items: [
		{ id: 't1', title: 'Fix the deploy', status: 'ready', owner: 'agent:main' },
		{ id: 't2', title: 'Write docs', status: 'backlog', owner: null }
	]
};

describe('TOON/JSON equivalence', () => {
	it('renders the same projection in both modes (decode(TOON) == JSON)', () => {
		const toon = render(sample);
		const json = JSON.parse(render(sample, { json: true }));
		expect(decode(toon)).toEqual(json);
	});

	it('field narrowing applies identically to both modes', () => {
		const toon = render(sample, { fields: ['title'] });
		const json = JSON.parse(render(sample, { json: true, fields: ['title'] }));
		expect(decode(toon)).toEqual(json);
		expect(json.items[0]).toEqual({ id: 't1', title: 'Fix the deploy' });
	});
});

describe('truncation and --full', () => {
	const long = 'x'.repeat(1200);

	it('truncates long content with metadata and the exact full-content command', () => {
		const prepared = preparePayload(
			{ id: 't1', summary: long },
			{ fullCommand: 'falcon task get t1 --full' }
		);
		expect((prepared.summary as string).length).toBe(501);
		expect(prepared.truncated).toEqual([
			{ field: 'summary', original_chars: 1200, shown_chars: 500 }
		]);
		expect(prepared.full_content).toContain('falcon task get t1 --full');
	});

	it('--full returns complete content with no truncation metadata', () => {
		const prepared = preparePayload({ id: 't1', summary: long }, { full: true });
		expect(prepared.summary).toBe(long);
		expect(prepared.truncated).toBeUndefined();
	});

	it('short content carries no truncation noise', () => {
		const prepared = preparePayload({ id: 't1', summary: 'short' }, {});
		expect(prepared.truncated).toBeUndefined();
	});
});

describe('loud unknown input', () => {
	it('unknown flags fail with usage exit class 2', () => {
		try {
			parseArgs(['--bogus', 'x'], { title: 'string' });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(CliError);
			expect((error as CliError).code).toBe('usage');
			expect((error as CliError).exitCode).toBe(2);
			expect((error as CliError).suggestions).toContain('--title');
		}
	});

	it('missing flag values and bad numbers fail loudly', () => {
		expect(() => parseArgs(['--title'], { title: 'string' })).toThrowError(
			expect.objectContaining({ code: 'usage' })
		);
		expect(() => parseArgs(['--due-at', 'soon'], { due_at: 'number' })).toThrowError(
			expect.objectContaining({ code: 'usage' })
		);
	});

	it('kebab-case flags map to snake_case fields', () => {
		const { flags } = parseArgs(['--resume-condition', 'Fred replies'], {
			resume_condition: 'string'
		});
		expect(flags.resume_condition).toBe('Fred replies');
	});
});

describe('stable exit classes', () => {
	it('maps server error codes to the shared exit classes', () => {
		expect(cliErrorFromShape({ code: 'validation_failed', message: 'x' }).exitCode).toBe(2);
		expect(cliErrorFromShape({ code: 'not_found', message: 'x' }).exitCode).toBe(3);
		expect(cliErrorFromShape({ code: 'transition_not_allowed', message: 'x' }).exitCode).toBe(4);
		expect(cliErrorFromShape({ code: 'version_conflict', message: 'x' }).exitCode).toBe(5);
		expect(cliErrorFromShape({ code: 'authority_required', message: 'x' }).exitCode).toBe(6);
		expect(cliErrorFromShape({ code: 'runtime_unavailable', message: 'x' }).exitCode).toBe(7);
	});

	it('CLI transport codes have stable classes; unknown errors exit 1', () => {
		expect(new CliError('usage', 'x').exitCode).toBe(2);
		expect(new CliError('unauthorized', 'x').exitCode).toBe(6);
		expect(new CliError('network', 'x').exitCode).toBe(7);
		expect(exitCodeFor(new Error('boom'))).toBe(1);
	});

	it('carries valid alternatives from structured errors into suggestions', () => {
		const error = cliErrorFromShape({
			code: 'transition_not_allowed',
			message: 'nope',
			alternatives: ['reopen_task']
		});
		expect(error.suggestions).toEqual(['Valid: reopen_task']);
	});
});
