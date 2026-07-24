import { describe, expect, it } from 'vitest';
import {
	commandDispatchTarget,
	commandTargetAllowed,
	formDateToEpoch,
	formScalarValue,
	projectLocalCreationAllowed,
	requiredCommandMeta
} from './ui.js';

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

describe('Work UI typed scalar payloads', () => {
	it('serializes structure numbers and booleans to their command payload types', () => {
		expect(formScalarValue('sequence', '3')).toBe(3);
		expect(formScalarValue('parallel', 'true')).toBe(true);
		expect(formScalarValue('parallel_phases_allowed', 'false')).toBe(false);
	});

	it('rejects malformed typed scalar values', () => {
		expect(() => formScalarValue('sequence', 'third')).toThrow('sequence must be a number');
		expect(() => formScalarValue('parallel', 'yes')).toThrow('parallel must be true or false');
	});
});

describe('Work UI command targeting', () => {
	it('uses posted child targets for scoped lifecycle commands', () => {
		expect(commandDispatchTarget('activate_phase', 'p1', 'ph2', '7')).toEqual({
			targetType: 'phase',
			target: 'ph2',
			expectedVersion: 7
		});
	});

	it('removes page targets and versions from creation commands', () => {
		expect(commandDispatchTarget('create_milestone', 'p1', undefined, '4')).toEqual({
			targetType: null
		});
	});

	it('binds same-type targets to the route and child targets to their Project', () => {
		expect(commandTargetAllowed('project', 'project', 'p1', 'p1')).toBe(true);
		expect(commandTargetAllowed('project', 'project', 'p1', 'p2')).toBe(false);
		expect(commandTargetAllowed('phase', 'project', 'p1', 'ph1', 'p1')).toBe(true);
		expect(commandTargetAllowed('phase', 'project', 'p1', 'ph2', 'p2')).toBe(false);
		expect(commandTargetAllowed('phase', 'project', 'p1', undefined, undefined)).toBe(false);
	});

	it('binds targetless child creation payloads to the route Project', () => {
		expect(projectLocalCreationAllowed('create_phase', 'project', 'p1', 'p1')).toBe(true);
		expect(projectLocalCreationAllowed('create_phase', 'project', 'p1', 'p2')).toBe(false);
		expect(projectLocalCreationAllowed('create_milestone', 'project', 'p1', 'p2')).toBe(false);
		expect(projectLocalCreationAllowed('create_task', 'project', 'p1', undefined)).toBe(false);
		expect(projectLocalCreationAllowed('create_project', 'task', 't1', undefined)).toBe(false);
	});

	it('rejects missing and unknown commands before target routing', () => {
		expect(() => requiredCommandMeta(undefined)).toThrow(
			expect.objectContaining({ code: 'unknown_command' })
		);
		expect(() => requiredCommandMeta('not_a_command')).toThrow(
			expect.objectContaining({ code: 'unknown_command' })
		);
		expect(requiredCommandMeta('update_project')).toMatchObject({
			name: 'update_project',
			target: 'project'
		});
	});
});
