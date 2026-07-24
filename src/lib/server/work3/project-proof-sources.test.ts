import { describe, expect, it } from 'vitest';
import type { SourceRef } from '$lib/work3-shared/types.js';
import { resolveProjectProofSources } from './project-proof-sources.js';

function refs(prefix: string, count: number): SourceRef[] {
	return Array.from({ length: count }, (_, index) => ({
		kind: 'file',
		ref: `/tmp/${prefix}-${index}`
	}));
}

describe('Project proof source resolution', () => {
	it('uses one bounded batch and reports omitted references on their holder', async () => {
		const project = {
			completion_criteria: [
				{
					satisfactions: [{ source_refs: refs('criterion', 8) }]
				}
			],
			milestones: [{ source_refs: refs('milestone', 2) }]
		};
		const seen: SourceRef[][] = [];
		await resolveProjectProofSources(project, async (sourceRefs) => {
			seen.push(sourceRefs);
			return {
				resolutions: sourceRefs.slice(0, 8).map((_, index) => ({
					available: index % 2 === 0,
					...(index % 2 === 0 ? {} : { reason: 'missing' })
				})),
				omitted: 2
			};
		});

		expect(seen).toHaveLength(1);
		expect(seen[0]).toHaveLength(10);
		expect(project.completion_criteria[0].satisfactions[0]).toMatchObject({
			source_refs: expect.arrayContaining([
				expect.objectContaining({ available: true }),
				expect.objectContaining({ available: false, reason: 'missing' })
			]),
			source_refs_omitted: 0
		});
		expect(project.milestones[0]).toMatchObject({
			source_refs: [],
			source_refs_omitted: 2
		});
	});

	it('resolves Milestone relationship satisfaction sources', async () => {
		const project = {
			milestones: [
				{
					source_refs: [],
					satisfactions: [{ source_refs: refs('milestone-satisfaction', 1) }]
				}
			]
		};
		await resolveProjectProofSources(project, async (sourceRefs) => ({
			resolutions: sourceRefs.map(() => ({ available: false, reason: 'missing' })),
			omitted: 0
		}));

		expect(project.milestones[0].satisfactions[0]).toMatchObject({
			source_refs: [expect.objectContaining({ available: false, reason: 'missing' })],
			source_refs_omitted: 0
		});
	});

	it('resolves scoped criterion and Milestone contribution sources', async () => {
		const project = {
			completion_criteria: [
				{
					contributions: [{ source_refs: refs('criterion-contribution', 1) }]
				}
			],
			milestones: [
				{
					contributions: [{ source_refs: refs('milestone-contribution', 1) }]
				}
			]
		};
		await resolveProjectProofSources(project, async (sourceRefs) => ({
			resolutions: sourceRefs.map(() => ({ available: true })),
			omitted: 0
		}));

		expect(project.completion_criteria[0].contributions[0]).toMatchObject({
			source_refs: [expect.objectContaining({ available: true })],
			source_refs_omitted: 0
		});
		expect(project.milestones[0].contributions[0]).toMatchObject({
			source_refs: [expect.objectContaining({ available: true })],
			source_refs_omitted: 0
		});
	});

	it('resolves historical Milestone satisfaction sources', async () => {
		const project = {
			milestones: [
				{
					historical_satisfactions: [{ source_refs: refs('historical-milestone-satisfaction', 1) }]
				}
			]
		};
		await resolveProjectProofSources(project, async (sourceRefs) => ({
			resolutions: sourceRefs.map(() => ({ available: true })),
			omitted: 0
		}));

		expect(project.milestones[0].historical_satisfactions[0]).toMatchObject({
			source_refs: [expect.objectContaining({ available: true })],
			source_refs_omitted: 0
		});
	});

	it('resolves unscoped Project contribution sources', async () => {
		const project = {
			unscoped_contributions: [{ source_refs: refs('project-contribution', 1) }]
		};
		await resolveProjectProofSources(project, async (sourceRefs) => ({
			resolutions: sourceRefs.map(() => ({ available: true })),
			omitted: 0
		}));

		expect(project.unscoped_contributions[0]).toMatchObject({
			source_refs: [expect.objectContaining({ available: true })],
			source_refs_omitted: 0
		});
	});
});
