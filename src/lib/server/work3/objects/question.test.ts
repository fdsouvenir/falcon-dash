// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '$lib/work3-shared/types.js';
import {
	answerHistory,
	currentAnswer,
	executeCommand,
	getWork3Db,
	loadEntity,
	loadQuestion,
	registerWork3Objects
} from '../index.js';
import { setupWork3TestDbs, teardownWork3TestDbs, type Work3TestContext } from '../testing.js';

/** Question contract tests (template §1–7) + answer-revision provenance. */

let context: Work3TestContext;
const agent: Actor = { kind: 'agent', id: 'main', label: 'Main Agent' };
const person: Actor = { kind: 'person', id: 'fred', label: 'Fred' };

let areaId: string;

async function cmd<T = Record<string, unknown>>(
	command: string,
	target?: string,
	payload: Record<string, unknown> = {},
	actor: Actor = agent
) {
	return executeCommand<T>({
		command,
		actor,
		target: target ?? null,
		expected_version: target ? loadEntity(getWork3Db(), target)!.version : undefined,
		payload
	});
}

async function createQuestion(payload: Record<string, unknown> = {}): Promise<string> {
	const created = await cmd<{ id: string }>('create_question', undefined, {
		area_id: areaId,
		question: 'Which registry should the CLI publish to?',
		impact: 'Blocks the release pipeline design',
		...payload
	});
	return created.result.id;
}

const REF = [{ kind: 'url', ref: 'https://npm.example/policy', label: 'Registry policy' }];

beforeEach(async () => {
	context = setupWork3TestDbs();
	registerWork3Objects();
	areaId = (await cmd<{ id: string }>('create_area', undefined, { title: 'Ops' })).result.id;
});

afterEach(() => {
	teardownWork3TestDbs(context);
});

describe('create_question', () => {
	it('creates an open Question with a syntactically explicit prompt', async () => {
		const id = await createQuestion();
		expect(loadQuestion(getWork3Db(), id)).toMatchObject({ status: 'open' });
	});

	it('rejects non-questions and missing Areas', async () => {
		await expect(
			cmd('create_question', undefined, { area_id: areaId, question: 'Publish to npm' })
		).rejects.toMatchObject({ code: 'validation_failed' });
		await expect(
			cmd('create_question', undefined, { area_id: 'a99', question: 'Where?' })
		).rejects.toMatchObject({ code: 'validation_failed' });
	});

	it('validates working hypotheses (confidence + sources required)', async () => {
		await expect(
			createQuestion({ working_hypothesis: { text: 'Probably GitHub Packages' } })
		).rejects.toMatchObject({ code: 'validation_failed' });

		const id = await createQuestion({
			working_hypothesis: {
				text: 'Probably GitHub Packages',
				confidence: 'tentative',
				source_refs: REF
			}
		});
		const row = loadQuestion(getWork3Db(), id)!;
		expect(JSON.parse(row.working_hypothesis!)).toMatchObject({ confidence: 'tentative' });
		// Hypotheses never change lifecycle.
		expect(row.status).toBe('open');
	});
});

describe('answer_question', () => {
	it('answers with confidence and sources; status becomes answered', async () => {
		const id = await createQuestion();
		const result = await cmd('answer_question', id, {
			answer: 'GitHub Packages, per the hosting policy',
			confidence: 'supported',
			source_refs: REF
		});
		expect(result.result).toMatchObject({ status: 'answered' });
		const answer = currentAnswer(getWork3Db(), id)!;
		expect(answer).toMatchObject({ answerer_id: 'main', confidence: 'supported' });
		expect(JSON.parse(answer.source_refs)).toHaveLength(1);
	});

	it('supported agent answers require sources; person answers stand as the human source', async () => {
		const id = await createQuestion();
		await expect(
			cmd('answer_question', id, { answer: 'GitHub Packages', confidence: 'supported' })
		).rejects.toMatchObject({ code: 'validation_failed' });

		const asPerson = await cmd(
			'answer_question',
			id,
			{ answer: 'GitHub Packages', confidence: 'confirmed' },
			person
		);
		expect(asPerson.ok).toBe(true);
		expect(currentAnswer(getWork3Db(), id)?.answerer_kind).toBe('person');
	});

	it('re-answering preserves the prior answer as an immutable revision', async () => {
		const id = await createQuestion();
		await cmd('answer_question', id, { answer: 'A', confidence: 'tentative' });
		await cmd('answer_question', id, { answer: 'B', confidence: 'supported', source_refs: REF });

		const history = answerHistory(getWork3Db(), id);
		expect(history).toHaveLength(2);
		expect(history[0]).toMatchObject({ answer: 'A', is_current: 0, supersedes: null });
		expect(history[1]).toMatchObject({ answer: 'B', is_current: 1, supersedes: history[0].id });
	});

	it('repeating the same answer from the same source is an idempotent no-op', async () => {
		const id = await createQuestion();
		await cmd('answer_question', id, { answer: 'A', confidence: 'tentative' });
		const repeat = await cmd('answer_question', id, { answer: 'A', confidence: 'tentative' });
		expect(repeat.noop).toBe(true);
		expect(answerHistory(getWork3Db(), id)).toHaveLength(1);
	});

	it('auto-resolves blockers whose dependency source is this Question', async () => {
		const id = await createQuestion();
		const task = await cmd<{ id: string }>('create_task', undefined, {
			area_id: areaId,
			title: 'Publish package'
		});
		await cmd('create_blocker', undefined, {
			blocked_id: task.result.id,
			source_kind: 'work',
			source_work_id: id,
			reason: 'Registry undecided',
			resolution_condition: 'Question answered'
		});

		const answered = await cmd('answer_question', id, {
			answer: 'GitHub Packages',
			confidence: 'confirmed',
			source_refs: REF
		});
		expect(answered.events.some((event) => event.event_type === 'blocker_resolved')).toBe(true);
		const blockers = getWork3Db()
			.prepare(`SELECT state FROM blockers WHERE source_work_id = ?`)
			.all(id) as Array<{ state: string }>;
		expect(blockers.every((blocker) => blocker.state === 'resolved')).toBe(true);
		// But it never silently completes the blocked Task.
		const task2 = getWork3Db()
			.prepare('SELECT status FROM tasks WHERE entity_id = ?')
			.get(task.result.id) as {
			status: string;
		};
		expect(task2.status).toBe('backlog');
	});
});

describe('revise_answer / withdraw / reopen', () => {
	it('revise_answer keeps lifecycle answered and extends history', async () => {
		const id = await createQuestion();
		await cmd('answer_question', id, { answer: 'A', confidence: 'tentative' });
		await cmd('revise_answer', id, {
			answer: 'A, but with caveats',
			confidence: 'supported',
			source_refs: REF
		});
		expect(loadQuestion(getWork3Db(), id)?.status).toBe('answered');
		expect(answerHistory(getWork3Db(), id)).toHaveLength(2);
	});

	it('revise_answer requires an answered Question', async () => {
		const id = await createQuestion();
		await expect(
			cmd('revise_answer', id, { answer: 'X', confidence: 'tentative' })
		).rejects.toMatchObject({ code: 'transition_not_allowed' });
	});

	it('withdrawal applies only to unanswered Questions and requires a reason', async () => {
		const id = await createQuestion();
		await cmd('answer_question', id, { answer: 'A', confidence: 'tentative' });
		await expect(cmd('withdraw_question', id, { reason: 'moot' })).rejects.toMatchObject({
			code: 'transition_not_allowed'
		});

		const other = await createQuestion();
		await expect(cmd('withdraw_question', other)).rejects.toMatchObject({
			code: 'validation_failed'
		});
		await cmd('withdraw_question', other, { reason: 'No longer relevant' });
		expect(loadQuestion(getWork3Db(), other)?.status).toBe('withdrawn');
	});

	it('reopening requires a reason and preserves answer history', async () => {
		const id = await createQuestion();
		await cmd('answer_question', id, { answer: 'A', confidence: 'tentative' });
		await cmd('reopen_question', id, { reason: 'Answer was wrong' });
		expect(loadQuestion(getWork3Db(), id)?.status).toBe('open');
		expect(answerHistory(getWork3Db(), id)).toHaveLength(1);

		const repeat = await cmd('reopen_question', id, { reason: 'again' });
		expect(repeat.noop).toBe(true);
	});
});
