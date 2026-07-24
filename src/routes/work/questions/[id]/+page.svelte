<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandBar,
		CommandFeedback,
		DataRow,
		PageHeader,
		Section,
		SourceRefs,
		StatusBadge,
		Timeline
	} from '$lib/components/work/index.js';
	import type { SourceRef as Work3SourceRef } from '$lib/work3-shared/types.js';
	import { parseQuestionSections } from '$lib/work3/sections.js';
	import type { ActionData, PageData } from './$types.js';

	type SourceRef = Work3SourceRef & {
		available?: boolean;
		reason?: string;
	};

	interface QuestionDetail {
		id: string;
		question: string;
		status: string;
		priority?: string | null;
		version: number;
		context?: string | null;
		impact?: string | null;
		steward?: string | null;
		answerable_by?: string[];
		working_hypothesis?: { text?: string; confidence?: string } | null;
		target_at?: number | null;
		area_id?: string | null;
		answer?: {
			id: string;
			answer: string;
			answerer?: string;
			confidence?: string;
			answered_at?: number;
			source_refs?: SourceRef[];
		} | null;
		answer_history?: Array<{
			id: string;
			answer: string;
			answerer?: string;
			confidence?: string;
			created_at?: number;
			supersedes?: string | null;
			is_current?: boolean;
		}>;
		history?: Array<{
			id?: string;
			occurred_at?: number;
			summary?: string;
			event_type?: string;
			version_from?: number | null;
			version_to?: number | null;
			actor?: { label?: string; kind?: string };
			authority_act?: boolean;
			source_refs?: unknown[];
		}>;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const question = $derived(data.question as unknown as QuestionDetail);
	const answerSources = $derived(data.answerSources as SourceRef[]);
	const answerSourcesOmitted = $derived(data.answerSourcesOmitted as number);
	const answerHistory = $derived([...(question.answer_history ?? [])].reverse());
	const questionSections = $derived(parseQuestionSections(question.context ?? ''));
	const answerIsAuthoritative = $derived(question.status === 'answered');
	const commands = $derived.by(() => {
		switch (question.status) {
			case 'open':
				return ['answer_question', 'withdraw_question'];
			case 'answered':
				return ['revise_answer', 'reopen_question'];
			case 'withdrawn':
				return ['reopen_question'];
			default:
				return [];
		}
	});

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not set';
	}
</script>

<svelte:head><title>{question.question} — Question</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<PageHeader
		eyebrow="Question"
		title={question.question}
		id={question.id}
		version={question.version}
		status={question.status}
		statusType="question"
		backHref={resolve('/work/browse?type=question')}
		backLabel="Browse questions"
	>
		{#snippet metadata()}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				{#if question.priority}
					<StatusBadge
						type="priority"
						value={question.priority}
						label={`${question.priority} priority`}
					/>
				{/if}
				{#if question.steward}
					<span class="text-[length:var(--text-label)] text-on-surface-variant">
						Steward: {question.steward}
					</span>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />

	{#if question.impact}
		<aside
			class="rounded-[var(--md-sys-shape-corner-large)] border border-status-warning/45 bg-status-warning-bg px-5 py-4 text-status-warning"
			aria-label="Question impact"
		>
			<p
				class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.14em]"
			>
				Why this needs an answer
			</p>
			<p class="mt-2 text-[length:var(--text-body)] leading-relaxed">{question.impact}</p>
		</aside>
	{/if}

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)]">
		<div class="space-y-5">
			<Section
				title="Question brief"
				description="The decision context, risks, and evidence boundary behind the prompt."
			>
				<div class="space-y-3">
					{#each questionSections as briefSection (briefSection.id)}
						<details
							open={briefSection.defaultOpen}
							class="group rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high"
						>
							<summary
								class="falcon-focus touch-target cursor-pointer rounded-[var(--md-sys-shape-corner-medium)] px-4 py-3 font-semibold text-on-surface"
							>
								{briefSection.title}
							</summary>
							<p
								class="whitespace-pre-wrap border-t border-outline-variant/60 px-4 py-3 text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
							>
								{briefSection.content}
							</p>
						</details>
					{/each}
				</div>
			</Section>

			{#if question.answer}
				<Section
					title={answerIsAuthoritative ? 'Authoritative answer' : 'Retained answer'}
					description={answerIsAuthoritative
						? 'The current answer revision. Earlier revisions remain visible below.'
						: 'This answer was invalidated when the Question reopened. It remains only as history.'}
					accent={answerIsAuthoritative ? 'info' : 'purple'}
				>
					<div class="space-y-4">
						<div class="flex flex-wrap items-center gap-2">
							<StatusBadge
								type="review"
								value={question.answer.confidence}
								label={`${question.answer.confidence ?? 'unknown'} confidence`}
							/>
							<span class="text-[length:var(--text-label)] text-on-surface-variant">
								{question.answer.answerer ?? 'Unknown answerer'} ·
								{dateLabel(question.answer.answered_at)}
							</span>
						</div>
						<p
							class="whitespace-pre-wrap text-[length:var(--text-body)] leading-relaxed text-on-surface"
						>
							{question.answer.answer}
						</p>
						<SourceRefs
							sources={answerSources}
							title="Answer sources"
							omittedCount={answerSourcesOmitted}
						/>
					</div>
				</Section>
			{/if}

			{#if answerHistory.length}
				<Section
					title="Answer revision history"
					description="Immutable answer revisions, newest authority first."
				>
					<ol class="divide-y divide-outline-variant/60">
						{#each answerHistory as revision (revision.id)}
							<li class="py-4 first:pt-0 last:pb-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
										{revision.id}
									</span>
									{#if revision.is_current}
										<StatusBadge
											type="question"
											value={answerIsAuthoritative ? 'answered' : 'open'}
											label={answerIsAuthoritative ? 'Current' : 'Latest retained'}
										/>
									{/if}
								</div>
								<p class="mt-2 whitespace-pre-wrap text-on-surface">{revision.answer}</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									{revision.answerer ?? 'Unknown answerer'} · {revision.confidence ?? 'unknown'} confidence
									· {dateLabel(revision.created_at)}
								</p>
							</li>
						{/each}
					</ol>
				</Section>
			{/if}

			{#if question.history?.length}
				<Section title="Timeline" description="Immutable command history and version transitions.">
					<Timeline events={question.history} />
				</Section>
			{/if}
		</div>

		<div class="space-y-5">
			{#if question.working_hypothesis}
				<Section
					title="Working hypothesis"
					description="A provisional explanation, not the authoritative answer."
					accent="purple"
				>
					<p class="text-[length:var(--text-body)] leading-relaxed text-on-surface">
						{question.working_hypothesis.text ?? 'No hypothesis text recorded.'}
					</p>
					<p class="mt-2 text-[length:var(--text-label)] text-on-surface-variant">
						{question.working_hypothesis.confidence ?? 'Unknown'} confidence
					</p>
				</Section>
			{/if}

			<Section title="Operating context" description="Ownership, answerability, and timing.">
				<dl>
					<DataRow label="Steward" value={question.steward ?? 'Unassigned'} />
					<DataRow
						label="Answerable by"
						value={question.answerable_by?.join(', ') || 'No answerers named'}
					/>
					<DataRow label="Target" value={dateLabel(question.target_at)} />
					<DataRow label="Area" value={question.area_id ?? 'Not assigned'} mono />
				</dl>
			</Section>
		</div>
	</div>

	<CommandBar
		{commands}
		targetId={question.id}
		expectedVersion={question.version}
		form={form as never}
	/>
</div>
