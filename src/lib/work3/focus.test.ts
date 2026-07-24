import { describe, expect, it } from 'vitest';
import { isAgentIdentity } from '$lib/work3-shared/identity.js';
import {
	filterByFocus,
	focusCounts,
	focusDefinitionsForType,
	isTerminalBrowseItem,
	matchesFocus,
	WORK_FOCUS_DEFINITIONS
} from './focus.js';

const NOW = Date.UTC(2026, 6, 24, 12);

describe('Work focus taxonomy', () => {
	it('declares exactly one filter strategy for every focus', () => {
		for (const definition of WORK_FOCUS_DEFINITIONS) {
			expect(Boolean(definition.serverFilter) !== Boolean(definition.clientPredicate)).toBe(true);
		}
	});

	it('classifies agent identities consistently', () => {
		expect(isAgentIdentity('agent:sidekick')).toBe(true);
		expect(isAgentIdentity(' Bot-17 ')).toBe(true);
		expect(isAgentIdentity('fred')).toBe(false);
		expect(isAgentIdentity(null)).toBe(false);
	});

	it('filters task focus from list projections', () => {
		const items = [
			{ id: 't1', status: 'ready', actionability: 'actionable', due_at: NOW - 1 },
			{ id: 't2', status: 'waiting', actionability: 'waiting', waiting_on: 'fred' },
			{ id: 't3', status: 'waiting', actionability: 'waiting', waiting_on: 'agent:ops' },
			{ id: 't4', status: 'in_review', actionability: 'needs_human' },
			{ id: 't5', status: 'ready', actionability: 'blocked', blocker_summary: 'Dependency' }
		];

		expect(filterByFocus(items, 'task', 'overdue', NOW).map((item) => item.id)).toEqual(['t1']);
		expect(filterByFocus(items, 'task', 'waiting-on-you', NOW).map((item) => item.id)).toEqual([
			't2'
		]);
		expect(filterByFocus(items, 'task', 'blocked', NOW).map((item) => item.id)).toEqual(['t5']);
		expect(focusCounts(items, 'task', NOW)).toMatchObject({
			overdue: 1,
			blocked: 1,
			'waiting-on-you': 1,
			'in-review': 1,
			ready: 1
		});
	});

	it('uses server-derived project health and projected dates', () => {
		const staleAt = NOW - 15 * 24 * 60 * 60 * 1000;
		const blocked = {
			id: 'p1',
			status: 'active',
			health: 'blocked',
			current_next_valid: true,
			target_at: NOW + 1,
			updated_at: NOW
		};
		const drifting = {
			id: 'p2',
			status: 'active',
			health: 'at_risk',
			current_next_valid: false,
			target_at: NOW - 1,
			updated_at: staleAt
		};

		expect(matchesFocus(blocked, 'project', 'blocked', NOW)).toBe(true);
		expect(matchesFocus(drifting, 'project', 'at-risk', NOW)).toBe(true);
		expect(matchesFocus(drifting, 'project', 'no-next-move', NOW)).toBe(true);
		expect(matchesFocus(drifting, 'project', 'overdue', NOW)).toBe(true);
		expect(matchesFocus(drifting, 'project', 'stale', NOW)).toBe(true);
	});

	it('keeps change authorization, verification, and failure distinct', () => {
		const authorization = {
			execution_state: 'not_started',
			verification_state: 'not_started',
			authorization: { state: 'missing' }
		};
		const verification = {
			execution_state: 'succeeded',
			verification_state: 'in_progress',
			authorization: { state: 'consumed' }
		};
		const failure = {
			execution_state: 'succeeded',
			verification_state: 'failed',
			authorization: { state: 'consumed' }
		};

		expect(matchesFocus(authorization, 'change_request', 'needs-authorization', NOW)).toBe(true);
		expect(matchesFocus(verification, 'change_request', 'verification-pending', NOW)).toBe(true);
		expect(matchesFocus(failure, 'change_request', 'failed', NOW)).toBe(true);
		expect(matchesFocus(verification, 'change_request', 'needs-authorization', NOW)).toBe(false);
	});

	it('exposes finding validity as reader-backed focuses', () => {
		expect(focusDefinitionsForType('finding').map((definition) => definition.key)).toEqual([
			'current',
			'superseded',
			'retracted'
		]);
		expect(matchesFocus({ validity: 'superseded' }, 'finding', 'superseded', NOW)).toBe(true);
	});

	it('separates terminal and archived browse rows', () => {
		expect(isTerminalBrowseItem('task', { status: 'completed' })).toBe(true);
		expect(
			isTerminalBrowseItem('change_request', {
				execution_state: 'succeeded',
				verification_state: 'passed'
			})
		).toBe(true);
		expect(isTerminalBrowseItem('project', { status: 'active', archived: true })).toBe(true);
		expect(isTerminalBrowseItem('finding', { validity: 'current' })).toBe(false);
	});
});
