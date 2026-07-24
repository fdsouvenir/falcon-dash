<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandBar,
		CommandFeedback,
		CommandForm,
		DataRow,
		PageHeader,
		Section,
		StatusBadge,
		Timeline
	} from '$lib/components/work/index.js';
	import type { ActionData, PageData } from './$types.js';

	interface DecisionOption {
		id: string;
		label: string;
		summary?: string | null;
		tradeoffs?: string | null;
	}

	interface DecisionDetail {
		id: string;
		title: string;
		status: string;
		version: number;
		prompt: string;
		context?: string | null;
		stakes?: string | null;
		consequence_of_no_decision: string;
		deciders?: string[];
		options?: DecisionOption[];
		recommendation?: { option_id?: string; rationale?: string } | null;
		outcome?: {
			option_id?: string;
			option_label?: string;
			rationale?: string;
			decided_by?: { label?: string };
			decided_at?: number;
			authority_basis?: {
				kind?: string;
				source_ref?: { label?: string; ref?: string };
			};
		} | null;
		needed_by?: number | null;
		priority?: string | null;
		supersedes?: string | null;
		superseded_by?: string | null;
		package_id?: string | null;
		area_id?: string | null;
		created_at?: number | null;
		updated_at?: number | null;
		package_history?: Array<{
			id?: string;
			revision?: number;
			title?: string;
			prompt?: string;
			created_at?: number;
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
	const decision = $derived(data.decision as unknown as DecisionDetail);
	const decidable = $derived(decision.status === 'pending' || decision.status === 'deferred');
	const headerDescription = $derived(
		decision.prompt.trim() === decision.title.trim() ? undefined : decision.prompt
	);
	const optionChoices = $derived({
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
	});
	const commands = $derived.by(() => {
		if (decision.status === 'pending') {
			return ['defer_decision', 'withdraw_decision', 'revise_decision'];
		}
		if (decision.status === 'deferred') {
			return ['resume_decision', 'withdraw_decision', 'revise_decision'];
		}
		if (decision.status === 'decided' && !decision.superseded_by) {
			return ['supersede_decision'];
		}
		return [];
	});

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not set';
	}

	function preview(value: string, limit = 420): string {
		if (value.length <= limit) return value;
		return `${value.slice(0, limit).trimEnd()}…`;
	}
</script>

<svelte:head><title>{decision.title} — Decision</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<PageHeader
		eyebrow="Decision"
		title={decision.title}
		id={decision.id}
		version={decision.version}
		status={decision.status}
		statusType="decision"
		description={headerDescription}
		backHref={resolve('/work/browse?type=decision')}
		backLabel="Browse decisions"
	>
		{#snippet metadata()}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				{#if decision.priority}
					<StatusBadge
						type="priority"
						value={decision.priority}
						label={`${decision.priority} priority`}
					/>
				{/if}
				<span class="text-[length:var(--text-label)] text-on-surface-variant">
					Needed by {dateLabel(decision.needed_by)}
				</span>
			</div>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />

	<div class="grid gap-5 md:grid-cols-2">
		<Section
			title="What is at stake"
			description="The material consequence attached to this choice."
			accent="info"
		>
			<p class="text-[length:var(--text-body)] leading-relaxed text-on-surface">
				{decision.stakes ?? 'No explicit stakes recorded.'}
			</p>
		</Section>
		<Section
			title="If no decision is made"
			description="The cost or default path of leaving this unresolved."
			accent="warning"
		>
			<p class="text-[length:var(--text-body)] leading-relaxed text-on-surface">
				{preview(decision.consequence_of_no_decision)}
			</p>
			{#if decision.consequence_of_no_decision.length > 420}
				<details class="mt-3">
					<summary
						class="falcon-focus touch-target cursor-pointer rounded font-semibold text-primary"
					>
						Read the full consequence
					</summary>
					<p
						class="mt-3 whitespace-pre-wrap border-t border-outline-variant/60 pt-3 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
					>
						{decision.consequence_of_no_decision}
					</p>
				</details>
			{/if}
		</Section>
	</div>

	{#if decision.outcome}
		<Section
			title="Recorded outcome"
			description="This outcome is immutable; corrections create a superseding decision."
			accent="info"
		>
			<div class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<StatusBadge type="decision" value="decided" />
					<p class="font-semibold text-on-surface">
						{decision.outcome.option_label ?? decision.outcome.option_id ?? 'Outcome recorded'}
					</p>
				</div>
				<p class="whitespace-pre-wrap leading-relaxed text-on-surface">
					{decision.outcome.rationale ?? 'No rationale recorded.'}
				</p>
				<p class="text-[length:var(--text-label)] text-on-surface-variant">
					{decision.outcome.decided_by?.label ?? 'Unknown decider'} ·
					{dateLabel(decision.outcome.decided_at)} · authority:
					{decision.outcome.authority_basis?.kind ?? 'not recorded'}
					{#if decision.outcome.authority_basis?.source_ref}
						· {decision.outcome.authority_basis.source_ref.label ??
							decision.outcome.authority_basis.source_ref.ref}
					{/if}
				</p>
			</div>
		</Section>
	{/if}

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)]">
		<div class="space-y-5">
			<Section
				title="Decision package"
				description="The prepared options and current recommendation."
			>
				{#if decision.context}
					<details
						open={decision.context.length <= 900}
						class="mb-4 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high"
					>
						<summary
							class="falcon-focus touch-target cursor-pointer rounded-[var(--md-sys-shape-corner-medium)] px-4 py-3 font-semibold text-on-surface"
						>
							Background context
						</summary>
						<p
							class="whitespace-pre-wrap border-t border-outline-variant/60 px-4 py-3 text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
						>
							{decision.context}
						</p>
					</details>
				{/if}
				<ul class="space-y-3">
					{#each decision.options ?? [] as option (option.id)}
						<li
							class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
						>
							<div class="flex flex-wrap items-center gap-2">
								<p class="font-semibold text-on-surface">{option.label}</p>
								{#if decision.recommendation?.option_id === option.id}
									<span
										class="rounded-full bg-status-purple-bg px-2 py-0.5 text-[length:var(--text-badge)] font-semibold text-status-purple"
									>
										Recommended
									</span>
								{/if}
							</div>
							{#if option.summary}
								<p class="mt-2 text-[length:var(--text-body)] text-on-surface-variant">
									{option.summary}
								</p>
							{/if}
							{#if option.tradeoffs}
								<p class="mt-2 text-[length:var(--text-label)] text-on-surface-variant">
									Tradeoffs: {option.tradeoffs}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
				{#if decision.recommendation?.rationale}
					<div
						class="mt-4 rounded-[var(--md-sys-shape-corner-medium)] border border-status-purple/40 bg-status-purple-bg p-4"
					>
						<p
							class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.12em] text-status-purple"
						>
							Recommendation rationale
						</p>
						<p class="mt-2 text-on-surface">{decision.recommendation.rationale}</p>
					</div>
				{/if}
			</Section>

			{#if decidable}
				<Section
					title="Record the decision"
					description="Choose one package option and provide the human rationale."
					accent="warning"
				>
					<CommandForm
						command="decide"
						targetId={decision.id}
						expectedVersion={decision.version}
						form={form as never}
						choiceFields={optionChoices}
					/>
				</Section>
			{/if}

			{#if decision.package_history?.length}
				<Section
					title="Package revisions"
					description="Prior packages are retained so the decision basis stays auditable."
				>
					<ol class="divide-y divide-outline-variant/60">
						{#each decision.package_history as revision, index (revision.id ?? index)}
							<li class="py-3 first:pt-0 last:pb-0">
								<p class="font-medium text-on-surface">
									Revision {revision.revision ?? index + 1} · {revision.title ?? decision.title}
								</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									{dateLabel(revision.created_at)}
								</p>
							</li>
						{/each}
					</ol>
				</Section>
			{/if}

			{#if decision.history?.length}
				<Section title="Timeline" description="Immutable command history and authority acts.">
					<Timeline events={decision.history} />
				</Section>
			{/if}
		</div>

		<div class="space-y-5">
			<Section
				title="Decision authority"
				description="Who may decide and when the answer is needed."
			>
				<dl>
					<DataRow label="Deciders" value={decision.deciders?.join(', ') || 'No deciders named'} />
					<DataRow label="Needed by" value={dateLabel(decision.needed_by)} />
					<DataRow label="Area" value={decision.area_id ?? 'Not assigned'} mono />
					<DataRow label="Package" value={decision.package_id ?? 'Not assigned'} mono />
					<DataRow label="Updated" value={dateLabel(decision.updated_at)} />
				</dl>
			</Section>

			{#if decision.supersedes || decision.superseded_by}
				<Section
					title="Supersession lineage"
					description="Corrections preserve the full chain instead of rewriting history."
					accent="purple"
				>
					<div class="space-y-2 text-[length:var(--text-body)]">
						{#if decision.supersedes}
							<p class="text-on-surface-variant">
								Supersedes
								<a
									class="falcon-focus touch-target font-mono font-semibold text-primary hover:text-primary/80"
									href={resolve('/work/decisions/[id]', { id: decision.supersedes })}
								>
									{decision.supersedes}
								</a>
							</p>
						{/if}
						{#if decision.superseded_by}
							<p class="text-on-surface-variant">
								Superseded by
								<a
									class="falcon-focus touch-target font-mono font-semibold text-primary hover:text-primary/80"
									href={resolve('/work/decisions/[id]', { id: decision.superseded_by })}
								>
									{decision.superseded_by}
								</a>
							</p>
						{/if}
					</div>
				</Section>
			{/if}
		</div>
	</div>

	<CommandBar
		{commands}
		targetId={decision.id}
		expectedVersion={decision.version}
		form={form as never}
	/>
</div>
