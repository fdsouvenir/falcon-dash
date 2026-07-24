import { describe, expect, it } from 'vitest';
import { WORK3_COMMANDS } from '$lib/work3-shared/commands.js';
import { EXECUTION_STATES, VERIFICATION_STATES } from '$lib/server/work3/objects/change.js';
import { REVIEW_OUTCOMES } from '$lib/server/work3/objects/review.js';
import { TASK_PRIORITIES, TASK_STATUSES } from '$lib/server/work3/objects/task.js';
import { ANSWER_CONFIDENCES } from '$lib/server/work3/objects/question.js';
import { FINDING_CONFIDENCES } from '$lib/server/work3/objects/finding.js';
import { commandLabel, fieldHint, requiresConfirmation } from './labels.js';
import { TONE_MAPS, toneFor } from './tones.js';

const vocabularies: Array<[keyof typeof TONE_MAPS, readonly string[]]> = [
	['task', TASK_STATUSES],
	['priority', TASK_PRIORITIES],
	['change_execution', EXECUTION_STATES],
	['change_verification', VERIFICATION_STATES],
	['review', REVIEW_OUTCOMES],
	['question', ['open', 'answered', 'withdrawn']],
	['decision', ['pending', 'deferred', 'decided', 'withdrawn']],
	['authorization', ['valid', 'expired', 'revoked', 'consumed', 'invalidated']],
	['project', ['draft', 'planned', 'active', 'paused', 'completed', 'cancelled']],
	['project_health', ['on_track', 'at_risk', 'blocked', 'unknown']],
	['phase', ['planned', 'active', 'completed', 'skipped']],
	['milestone', ['planned', 'achieved', 'cancelled']],
	['schedule', ['none', 'due_soon', 'overdue', 'achieved']],
	['plan', ['draft', 'submitted', 'superseded', 'withdrawn']],
	['review', ['unreviewed', 'approved', 'changes_requested', 'rejected']],
	['finding', ['current', 'superseded', 'retracted']],
	['automaton', ['ok', 'paused', 'failing', 'unreachable', 'deleted']]
];

describe('Work UI contract maps', () => {
	it.each(vocabularies)('maps every %s vocabulary member', (type, values) => {
		for (const value of values) {
			expect(TONE_MAPS[type]).toHaveProperty(value);
			expect(toneFor(type, value)).not.toBeUndefined();
		}
	});

	it('maps shared confidence vocabularies to select choices', () => {
		const values = fieldHint('confidence').options?.map((option) => option.value);
		expect(values).toEqual([...ANSWER_CONFIDENCES]);
		expect(values).toEqual([...FINDING_CONFIDENCES]);
	});

	it('encodes authority sources as structured references', () => {
		expect(fieldHint('authority_source')).toMatchObject({
			kind: 'json',
			monospace: true
		});
	});

	it('gives every semantic command an operator-facing label', () => {
		for (const command of WORK3_COMMANDS) {
			const label = commandLabel(command.name);
			expect(label).toBeTruthy();
			expect(label).not.toBe(command.name);
		}
	});

	it('confirms terminal, authority, and execution commands', () => {
		for (const command of [
			'complete_task',
			'accept_task',
			'decide',
			'authorize_change',
			'start_change',
			'pass_verification',
			'waive_completion_criterion',
			'delete_automaton'
		]) {
			expect(requiresConfirmation(command), command).toBe(true);
		}
	});
});
