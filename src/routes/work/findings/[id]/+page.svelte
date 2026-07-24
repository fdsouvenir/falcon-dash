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
	import type { SourceRef } from '$lib/work3-shared/types.js';
	import type { ActionData, PageData } from './$types.js';

	type FindingSource = SourceRef & {
		available?: boolean;
		reason?: string;
	};

	interface FindingDetail {
		id: string;
		title: string;
		confidence: string;
		validity: string;
		source_count?: number;
		version: number;
		conclusion: string;
		significance?: string | null;
		targets?: string[];
		observed_at?: number | null;
		author?: string | null;
		supersedes?: string | null;
		superseded_by?: string | null;
		retract_reason?: string | null;
		area_id?: string | null;
		created_at?: number | null;
		updated_at?: number | null;
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
	const finding = $derived(data.finding as unknown as FindingDetail);
	const sources = $derived(data.sources as FindingSource[]);
	const sourcesOmitted = $derived(data.sourcesOmitted as number);
	const commands = $derived(
		finding.validity === 'current' ? ['supersede_finding', 'retract_finding'] : []
	);

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not set';
	}
</script>

<svelte:head><title>{finding.title} — Finding</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<PageHeader
		eyebrow="Finding"
		title={finding.title}
		id={finding.id}
		version={finding.version}
		status={finding.validity}
		statusType="finding"
		backHref={resolve('/work/browse?type=finding')}
		backLabel="Browse findings"
	>
		{#snippet metadata()}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				<StatusBadge
					type="review"
					value={finding.confidence}
					label={`${finding.confidence} confidence`}
				/>
				<span class="text-[length:var(--text-label)] text-on-surface-variant">
					{finding.author ?? 'Unknown author'} · observed {dateLabel(finding.observed_at)}
				</span>
			</div>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />

	{#if finding.retract_reason}
		<aside
			class="rounded-[var(--md-sys-shape-corner-large)] border border-status-danger/45 bg-status-danger-bg px-5 py-4 text-status-danger"
			role="status"
		>
			<p class="font-semibold">This finding was retracted</p>
			<p class="mt-1 text-[length:var(--text-body)]">{finding.retract_reason}</p>
		</aside>
	{/if}

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)]">
		<div class="space-y-5">
			<Section
				title="Conclusion"
				description="The durable evidence-backed claim carried by this finding."
				accent="info"
			>
				<p
					class="whitespace-pre-wrap text-[length:var(--md-sys-typescale-title-large-size)] font-medium leading-relaxed text-on-surface"
				>
					{finding.conclusion}
				</p>
				{#if finding.significance}
					<div class="mt-5 border-t border-outline-variant/60 pt-4">
						<p
							class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.12em] text-on-surface-variant"
						>
							Why it matters
						</p>
						<p class="mt-2 leading-relaxed text-on-surface">{finding.significance}</p>
					</div>
				{/if}
			</Section>

			<Section
				title="Evidence"
				description="References are resolved at read time so missing evidence is visible, not silently omitted."
			>
				<SourceRefs {sources} title="Finding sources" omittedCount={sourcesOmitted} />
			</Section>

			{#if finding.history?.length}
				<Section title="Timeline" description="Immutable command history and version transitions.">
					<Timeline events={finding.history} />
				</Section>
			{/if}
		</div>

		<div class="space-y-5">
			<Section
				title="Finding context"
				description="Attachment, authorship, and observation details."
			>
				<dl>
					<DataRow label="Validity">
						<StatusBadge type="finding" value={finding.validity} />
					</DataRow>
					<DataRow label="Confidence">
						<StatusBadge type="review" value={finding.confidence} label={finding.confidence} />
					</DataRow>
					<DataRow label="Sources" value={finding.source_count ?? sources.length} />
					<DataRow label="Author" value={finding.author ?? 'Unknown'} />
					<DataRow label="Observed" value={dateLabel(finding.observed_at)} />
					<DataRow label="Area" value={finding.area_id ?? 'Not assigned'} mono />
					<DataRow label="Updated" value={dateLabel(finding.updated_at)} />
				</dl>
			</Section>

			<Section
				title="Targets"
				description="Work objects this evidence is attached to."
				accent="purple"
			>
				{#if finding.targets?.length}
					<ul class="space-y-2">
						{#each finding.targets as target (target)}
							<li
								class="rounded-[var(--md-sys-shape-corner-small)] bg-surface-container-high px-3 py-2 font-mono text-[length:var(--text-mono)] text-on-surface"
							>
								{target}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-on-surface-variant">No targets attached.</p>
				{/if}
			</Section>

			{#if finding.supersedes || finding.superseded_by}
				<Section
					title="Supersession lineage"
					description="Corrections preserve the prior finding and its evidence."
					accent="purple"
				>
					<div class="space-y-2">
						{#if finding.supersedes}
							<p class="text-on-surface-variant">
								Supersedes
								<a
									class="falcon-focus touch-target font-mono font-semibold text-primary hover:text-primary/80"
									href={resolve('/work/findings/[id]', { id: finding.supersedes })}
								>
									{finding.supersedes}
								</a>
							</p>
						{/if}
						{#if finding.superseded_by}
							<p class="text-on-surface-variant">
								Superseded by
								<a
									class="falcon-focus touch-target font-mono font-semibold text-primary hover:text-primary/80"
									href={resolve('/work/findings/[id]', { id: finding.superseded_by })}
								>
									{finding.superseded_by}
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
		targetId={finding.id}
		expectedVersion={finding.version}
		form={form as never}
	/>
</div>
