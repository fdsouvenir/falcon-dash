import type { SourceRef } from '$lib/work3-shared/types.js';
import { resolveWork3SourceRefs } from './sources.js';

interface ProofSourceHolder {
	source_refs?: SourceRef[];
	source_refs_omitted?: number;
}

interface CriterionProjection {
	contributions?: ProofSourceHolder[];
	satisfactions?: ProofSourceHolder[];
}

interface MilestoneProjection extends ProofSourceHolder {
	contributions?: ProofSourceHolder[];
	satisfactions?: ProofSourceHolder[];
	historical_satisfactions?: ProofSourceHolder[];
}

type SourceResolver = typeof resolveWork3SourceRefs;

/**
 * Resolve Project proof in one bounded display batch. Holders keep their own
 * omitted count so the ledger can distinguish unresolved references from
 * references excluded by the global display cap.
 */
export async function resolveProjectProofSources(
	project: Record<string, unknown>,
	resolveSources: SourceResolver = resolveWork3SourceRefs
): Promise<void> {
	const criteria = Array.isArray(project.completion_criteria)
		? (project.completion_criteria as CriterionProjection[])
		: [];
	const milestones = Array.isArray(project.milestones)
		? (project.milestones as MilestoneProjection[])
		: [];
	const unscopedContributions = Array.isArray(project.unscoped_contributions)
		? (project.unscoped_contributions as ProofSourceHolder[])
		: [];
	const holders = [
		...criteria.flatMap((criterion) => criterion.satisfactions ?? []),
		...criteria.flatMap((criterion) => criterion.contributions ?? []),
		...milestones,
		...milestones.flatMap((milestone) => milestone.satisfactions ?? []),
		...milestones.flatMap((milestone) => milestone.historical_satisfactions ?? []),
		...milestones.flatMap((milestone) => milestone.contributions ?? []),
		...unscopedContributions
	].filter((holder) => Array.isArray(holder.source_refs) && holder.source_refs.length > 0);
	const refs = holders.flatMap((holder) => holder.source_refs ?? []);
	if (refs.length === 0) return;

	const { resolutions } = await resolveSources(refs);
	let cursor = 0;
	for (const holder of holders) {
		const original = holder.source_refs ?? [];
		const resolvedCount = Math.min(original.length, Math.max(0, resolutions.length - cursor));
		holder.source_refs = original.slice(0, resolvedCount).map((ref, index) => ({
			...ref,
			...resolutions[cursor + index]
		}));
		holder.source_refs_omitted = original.length - resolvedCount;
		cursor += resolvedCount;
	}
}
