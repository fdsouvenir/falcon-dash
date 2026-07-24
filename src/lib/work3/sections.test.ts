import { describe, expect, it } from 'vitest';
import { parseQuestionSections } from './sections.js';

describe('parseQuestionSections', () => {
	it('returns a useful context section for empty and unstructured content', () => {
		expect(parseQuestionSections('')[0]).toMatchObject({
			id: 'context',
			defaultOpen: true
		});
		expect(parseQuestionSections('A short question brief.')[0].content).toBe(
			'A short question brief.'
		);
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
