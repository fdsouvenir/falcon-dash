<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandBar,
		CommandFeedback,
		EmptyState,
		PageHeader,
		Section,
		StatusBadge
	} from '$lib/components/work/index.js';
	import type { ActionData, PageData } from './$types.js';

	interface QuestionRow {
		id: string;
		question: string;
		status: string;
		priority?: string | null;
		answerable_by?: string[];
		version: number;
	}

	interface DecisionOption {
		id: string;
		label: string;
		summary?: string;
		tradeoffs?: string;
	}

	interface DecisionRow {
		id: string;
		title: string;
		prompt?: string;
		status: string;
		consequence_of_no_decision?: string;
		recommendation?: { option_id?: string; rationale?: string };
		options?: DecisionOption[];
		version: number;
	}

	interface QueueItem {
		id: string;
		title?: string;
		why?: string;
		revision_id?: string;
		version?: number;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const questions = $derived(data.questions as unknown as QuestionRow[]);
	const decisions = $derived(data.decisions as unknown as DecisionRow[]);
	const reviews = $derived(data.awaitingReview.items as unknown as QueueItem[]);
	const authorizations = $derived(data.authorizations.items as unknown as QueueItem[]);

	const reviewOutcomeChoices = {
		create_review: {
			outcome: {
				label: 'Review outcome',
				options: [
					{ value: 'approved', label: 'Approved' },
					{ value: 'changes_requested', label: 'Changes requested' },
					{ value: 'rejected', label: 'Rejected' },
					{ value: 'commented', label: 'Comment only' }
				]
			}
		}
	};

	function objectCommandAction(type: 'question' | 'decision' | 'change', id: string): string {
		if (type === 'question') return `${resolve('/work/questions/[id]', { id })}?/command`;
		if (type === 'decision') return `${resolve('/work/decisions/[id]', { id })}?/command`;
		return `${resolve('/work/changes/[id]', { id })}?/command`;
	}

	function decisionChoices(decision: DecisionRow) {
		return {
			decide: {
				option_id: {
					label: 'Select the outcome',
					options: (decision.options ?? []).map((option) => ({
						value: option.id,
						label: option.label,
						description: [option.summary, option.tradeoffs && `Tradeoffs: ${option.tradeoffs}`]
							.filter(Boolean)
							.join(' · '),
						recommended: decision.recommendation?.option_id === option.id
					}))
				}
			}
		};
	}

	function decisionCommands(decision: DecisionRow): string[] {
		return decision.status === 'deferred'
			? ['decide', 'resume_decision', 'withdraw_decision']
			: ['decide', 'defer_decision', 'withdraw_decision'];
	}
</script>

{#snippet expandableRow(
	title: string,
	id: string,
	description: string | undefined,
	badges: Array<{ type: string; value: string }>
)}
	<summary
		class="falcon-focus touch-target cursor-pointer list-none rounded-[var(--md-sys-shape-corner-medium)] px-3 py-4 marker:hidden hover:bg-surface-container-high"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<span class="break-words font-semibold text-on-surface">{title}</span>
					{#each badges as badge (`${badge.type}:${badge.value}`)}
						<StatusBadge type={badge.type} value={badge.value} />
					{/each}
				</div>
				{#if description}
					<p
						class="mt-1 line-clamp-3 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
					>
						{description}
					</p>
				{/if}
			</div>
			<span class="shrink-0 text-right text-[length:var(--text-label)] text-on-surface-variant">
				<span class="block font-mono">{id}</span>
				<span class="mt-1 block font-semibold text-primary group-open:hidden">Expand</span>
				<span class="mt-1 hidden font-semibold text-primary group-open:block">Collapse</span>
			</span>
		</div>
	</summary>
{/snippet}

<svelte:head><title>Needs Resolution — Work</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-5">
	<PageHeader
		eyebrow="Human attention"
		title="Needs Resolution"
		description="Answer Questions, decide commitments, record Reviews, and grant exact-scope Authorization."
	/>

	<CommandFeedback form={form as never} />

	<div class="grid gap-5 xl:grid-cols-2">
		<Section
			title={`Questions (${questions.length})`}
			description="Missing knowledge that needs an authoritative answer."
			accent="warning"
		>
			{#if questions.length === 0}
				<EmptyState
					title="No open Questions"
					description="No Question currently needs an answer."
				/>
			{:else}
				<div class="divide-y divide-outline-variant/60">
					{#each questions as question (question.id)}
						<details class="group">
							{@render expandableRow(
								question.question,
								question.id,
								question.answerable_by?.length
									? `Answerable by ${question.answerable_by.join(', ')}`
									: undefined,
								question.priority
									? [
											{ type: 'question', value: question.status },
											{ type: 'priority', value: question.priority }
										]
									: [{ type: 'question', value: question.status }]
							)}
							<div class="space-y-3 px-3 pb-5">
								<a
									href={resolve('/work/questions/[id]', { id: question.id })}
									class="falcon-focus touch-target inline-flex font-semibold text-primary hover:text-primary/80"
								>
									Open full Question
								</a>
								<CommandBar
									commands={['answer_question', 'withdraw_question']}
									targetId={question.id}
									expectedVersion={question.version}
									action={objectCommandAction('question', question.id)}
									form={form as never}
									title="Question controls"
								/>
							</div>
						</details>
					{/each}
				</div>
			{/if}
		</Section>

		<Section
			title={`Decisions (${decisions.length})`}
			description="Commitments awaiting one recorded outcome."
			accent="warning"
		>
			{#if decisions.length === 0}
				<EmptyState
					title="No Decisions awaiting outcome"
					description="No pending or deferred Decision currently needs a call."
				/>
			{:else}
				<div class="divide-y divide-outline-variant/60">
					{#each decisions as decision (decision.id)}
						<details class="group">
							{@render expandableRow(
								decision.title,
								decision.id,
								decision.consequence_of_no_decision
									? `If unresolved: ${decision.consequence_of_no_decision}`
									: decision.prompt,
								[{ type: 'decision', value: decision.status }]
							)}
							<div class="space-y-3 px-3 pb-5">
								{#if decision.recommendation?.rationale}
									<p
										class="rounded-[var(--md-sys-shape-corner-medium)] bg-status-purple-bg px-3 py-3 text-[length:var(--text-label)] text-status-purple"
									>
										Recommendation: {decision.recommendation.rationale}
									</p>
								{/if}
								<a
									href={resolve('/work/decisions/[id]', { id: decision.id })}
									class="falcon-focus touch-target inline-flex font-semibold text-primary hover:text-primary/80"
								>
									Open decision package
								</a>
								<CommandBar
									commands={decisionCommands(decision)}
									targetId={decision.id}
									expectedVersion={decision.version}
									action={objectCommandAction('decision', decision.id)}
									form={form as never}
									choiceFieldsByCommand={decisionChoices(decision)}
									confirmationSubjectByCommand={{
										decide: decision.title
									}}
									title="Decision controls"
								/>
							</div>
						</details>
					{/each}
				</div>
			{/if}
		</Section>

		<Section
			title={`Reviews (${reviews.length})`}
			description="Evaluation of an exact submitted revision. Review does not grant execution authority."
			accent="info"
		>
			{#if reviews.length === 0}
				<EmptyState
					title="No Reviews waiting"
					description="Every submitted Plan revision has a recorded Review outcome."
				/>
			{:else}
				<div class="divide-y divide-outline-variant/60">
					{#each reviews as review (review.id)}
						<details class="group">
							{@render expandableRow(review.title ?? 'Submitted Plan', review.id, review.why, [
								{ type: 'review', value: 'unreviewed' }
							])}
							<div class="px-3 pb-5">
								<CommandBar
									commands={['create_review']}
									action="?/command"
									form={form as never}
									presetValuesByCommand={{
										create_review: {
											subject_id: review.id,
											subject_revision: review.revision_id ?? ''
										}
									}}
									choiceFieldsByCommand={reviewOutcomeChoices}
									confirmationSubjectByCommand={{
										create_review: `${review.title ?? review.id} · ${review.revision_id ?? 'current revision'}`
									}}
									submitLabelByCommand={{ create_review: 'Record Review' }}
									title="Review outcome"
								/>
							</div>
						</details>
					{/each}
				</div>
			{/if}
		</Section>

		<Section
			title={`Authorizations (${authorizations.length})`}
			description="Permission pinned to the exact Change and Plan revisions. This is not Review."
			accent="warning"
		>
			{#if authorizations.length === 0}
				<EmptyState
					title="No Authorization calls"
					description="No Change currently needs a human Authorization grant."
				/>
			{:else}
				<div class="divide-y divide-outline-variant/60">
					{#each authorizations as authorization (authorization.id)}
						<details class="group">
							{@render expandableRow(
								authorization.title ?? 'Change Request',
								authorization.id,
								authorization.why,
								[{ type: 'authorization', value: 'missing' }]
							)}
							<div class="space-y-3 px-3 pb-5">
								<a
									href={resolve('/work/changes/[id]', { id: authorization.id })}
									class="falcon-focus touch-target inline-flex font-semibold text-primary hover:text-primary/80"
								>
									Inspect exact Change scope
								</a>
								<CommandBar
									commands={[
										{
											command: 'authorize_change',
											enabled: !authorization.why?.includes('plan not submitted'),
											reason: authorization.why?.includes('plan not submitted')
												? 'Authorization unavailable — submit the exact Plan revision first.'
												: undefined
										}
									]}
									targetId={authorization.id}
									expectedVersion={authorization.version}
									action={objectCommandAction('change', authorization.id)}
									form={form as never}
									confirmationSubjectByCommand={{
										authorize_change: authorization.title ?? authorization.id
									}}
									title="Authorization controls"
								/>
							</div>
						</details>
					{/each}
				</div>
			{/if}
		</Section>
	</div>
</div>
