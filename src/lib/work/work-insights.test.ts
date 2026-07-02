import { describe, expect, it } from 'vitest';
import {
	matchesWorkFocus,
	literalBlockersFor,
	parseQuestionSections,
	projectPortfolioPulse,
	projectHealth,
	projectHasNoNextMove,
	projectOpenWork
} from './work-insights.js';
import type { WorkItem, WorkItemType, WorkStatus } from './work-ui.js';

const now = new Date('2026-06-25T12:00:00.000Z').valueOf();

function item(overrides: Partial<WorkItem> = {}): WorkItem {
	return {
		id: 1,
		type: 'project',
		area_id: null,
		parent_item_id: null,
		title: 'Example work',
		description: null,
		body: null,
		status: 'in_progress',
		owner: 'agent',
		waiting_on: null,
		priority: 'normal',
		next_action: null,
		approval_required: 0,
		due_date: null,
		scheduled_at: null,
		stale_after: null,
		result: null,
		legacy_project_id: null,
		legacy_plan_id: null,
		created_at: 1,
		updated_at: 1,
		last_activity_at: 1,
		...overrides
	};
}

function child(id: number, type: WorkItemType, status: WorkStatus): WorkItem {
	return item({ id, type, status, parent_item_id: 1, title: `${type} ${id}` });
}

describe('work insights', () => {
	it('does not treat an urgent project as blocked when no child is blocked', () => {
		const health = projectHealth(item({ priority: 'urgent' }), [], now);

		expect(health.label).toBe('Needs attention');
	});

	it('does not mark a project blocked when only later task work is blocked', () => {
		const project = item({ current_next_item_id: 2 });
		const health = projectHealth(
			project,
			[child(2, 'task', 'ready'), child(3, 'task', 'blocked')],
			now
		);

		expect(health.label).not.toBe('Blocked');
		expect(
			matchesWorkFocus(
				project,
				'blocked',
				[project, child(2, 'task', 'ready'), child(3, 'task', 'blocked')],
				now
			)
		).toBe(false);
	});

	it('marks an overdue project as overdue before decision attention', () => {
		const health = projectHealth(
			item({ due_date: '2026-06-12T12:00:00.000Z' }),
			[child(2, 'decision', 'needs_review')],
			now
		);

		expect(health.label).toBe('Overdue');
	});

	it('never returns the selected item as its own blocker', () => {
		const project = item({ status: 'blocked' });

		expect(literalBlockersFor(project, [project])).toEqual([]);
	});

	it('returns a blocked child as a literal blocker', () => {
		const blocked = child(2, 'change_request', 'blocked');

		expect(literalBlockersFor(item(), [blocked])).toEqual([blocked]);
	});

	it('marks child questions as needing a decision', () => {
		const health = projectHealth(item(), [child(2, 'decision', 'needs_review')], now);

		expect(health.label).toBe('Needs decision');
	});

	it('renders concrete open work counts without linked wording', () => {
		const summary = projectOpenWork(item(), [
			child(2, 'task', 'ready'),
			child(3, 'task', 'in_progress'),
			child(4, 'open_question', 'needs_review'),
			child(5, 'change_request', 'planning')
		]);

		expect(summary).toBe('2 tasks · 1 open question · 1 change request');
		expect(summary).not.toMatch(/linked/i);
	});

	it('builds portfolio pulse counts from project and child context', () => {
		const recentActivity = Math.floor(now / 1000);
		const blocked = item({ id: 10, title: 'Blocked project', last_activity_at: recentActivity });
		const overdue = item({ id: 20, title: 'Overdue project', last_activity_at: recentActivity });
		const decision = item({ id: 30, title: 'Decision project', last_activity_at: recentActivity });
		const noMove = item({ id: 40, title: 'No move project', last_activity_at: recentActivity });
		const stale = item({
			id: 50,
			title: 'Stale project',
			next_action: 'Continue',
			last_activity_at: Math.floor(new Date('2026-06-01T12:00:00.000Z').valueOf() / 1000)
		});
		const onTrack = item({
			id: 60,
			title: 'On track project',
			next_action: 'Ship',
			due_date: '2026-07-01T12:00:00.000Z',
			last_activity_at: recentActivity
		});
		const pulse = projectPortfolioPulse(
			[
				blocked,
				item({ id: 11, type: 'task', parent_item_id: blocked.id, status: 'blocked' }),
				overdue,
				child(21, 'task', 'ready'),
				item({
					id: 22,
					type: 'task',
					parent_item_id: overdue.id,
					status: 'ready',
					due_date: '2026-06-12T12:00:00.000Z'
				}),
				decision,
				item({
					id: 31,
					type: 'open_question',
					parent_item_id: decision.id,
					status: 'needs_review',
					waiting_on: 'operator'
				}),
				noMove,
				stale,
				onTrack
			],
			now
		);

		expect(pulse.openProjects).toBe(6);
		expect(pulse.metrics.find((metric) => metric.key === 'blocked')?.value).toBe(1);
		expect(pulse.metrics.find((metric) => metric.key === 'overdue')?.value).toBe(1);
		expect(pulse.metrics.find((metric) => metric.key === 'needs-decision')?.value).toBe(1);
		expect(pulse.metrics.find((metric) => metric.key === 'no-next-move')?.value).toBe(1);
		expect(pulse.metrics.find((metric) => metric.key === 'stale')?.value).toBe(1);
		expect(pulse.healthDistribution.find((health) => health.label === 'On track')?.value).toBe(1);
	});

	it('identifies projects with no next move only when no actionable child exists', () => {
		const project = item({ next_action: null });

		expect(projectHasNoNextMove(project, [])).toBe(true);
		expect(projectHasNoNextMove(project, [child(2, 'task', 'ready')])).toBe(false);
		expect(projectHasNoNextMove(item({ next_action: 'Review' }), [])).toBe(false);
	});

	it('matches type-aware filters and ignores unknown focus values', () => {
		const project = item({ id: 10, type: 'project' });
		const blockedNextStep = item({
			id: 11,
			type: 'task',
			parent_item_id: project.id,
			status: 'blocked'
		});
		const question = item({
			id: 20,
			type: 'open_question',
			status: 'complete',
			waiting_on: null
		});
		const nextStep = item({
			id: 30,
			type: 'task',
			status: 'ready',
			due_date: '2026-06-25T14:00:00.000Z'
		});
		const finding = item({
			id: 40,
			type: 'finding',
			parent_item_id: null,
			owner: 'agent-feed'
		});

		expect(matchesWorkFocus(project, 'blocked', [project, blockedNextStep], now)).toBe(true);
		expect(matchesWorkFocus(question, 'answered', [question], now)).toBe(true);
		expect(matchesWorkFocus(nextStep, 'due-today', [nextStep], now)).toBe(true);
		expect(matchesWorkFocus(finding, 'source', [finding], now, { source: 'agent-feed' })).toBe(
			true
		);
		expect(matchesWorkFocus(nextStep, 'not-a-real-filter', [nextStep], now)).toBe(true);
	});

	it('sections long question markdown and collapses history', () => {
		const sections = parseQuestionSections(`## Objective
Set up the internal workspace.

## Current Verified State
- Agency token exists.

## Current Verified State
- Agent confirmed the same state again after a reload.

## Approval Gate
Execution requires approval.

## Approval Gate
Second approval checkpoint.

## Legacy Version History
- v1 planning notes`);

		expect(sections.map((section) => section.title)).toEqual([
			'Objective',
			'Current Verified State',
			'Current Verified State',
			'Approval Gate',
			'Approval Gate',
			'Legacy Version History'
		]);
		expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
		expect(sections.find((section) => section.title === 'Objective')?.defaultOpen).toBe(true);
		expect(sections.find((section) => section.title === 'Approval Gate')?.defaultOpen).toBe(true);
		expect(
			sections.find((section) => section.title === 'Legacy Version History')?.defaultOpen
		).toBe(false);
		expect(sections[0].content).not.toContain('## Objective');
	});
});
