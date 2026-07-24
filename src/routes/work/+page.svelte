<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		EmptyState,
		Section,
		StatTile,
		Timeline,
		WorkItemRow
	} from '$lib/components/work/index.js';
	import { Tabs } from '$lib/components/ui/tabs/index.js';
	import { typeLabel } from '$lib/work3/hrefs.js';
	import { connectWorkQueueLive } from '$lib/work3/live.js';
	import type { PageData } from './$types.js';

	interface QueueItem {
		id?: string;
		type?: string;
		title?: string;
		status?: string;
		execution_state?: string;
		why?: string;
	}

	interface QueueBucket {
		total: number;
		by_type: Record<string, number>;
		items: QueueItem[];
	}

	interface RecentChange {
		id: string;
		at: number;
		event: string;
		summary: string;
		actor: string;
		authority_act?: boolean;
		authority_sources?: unknown[];
	}

	const linkedTypes = new Set([
		'task',
		'question',
		'open_question',
		'decision',
		'change',
		'change_request',
		'finding',
		'automaton',
		'automation',
		'project'
	]);

	let { data }: { data: PageData } = $props();
	const queue = $derived(data.queue as unknown as Record<string, QueueBucket>);
	const browseHref = resolve('/work/browse');
	const waiting = $derived(combineBuckets(queue.waiting_on_agent, queue.waiting_on_external));
	const recentEvents = $derived(
		(data.recentChanges as unknown as RecentChange[]).map((change) => ({
			id: change.id,
			occurred_at: change.at,
			event_type: change.event,
			summary: change.summary,
			actor: { label: change.actor },
			authority_act: change.authority_act,
			source_refs: change.authority_sources
		}))
	);
	let waitingTab = $state('agent');

	onMount(() => connectWorkQueueLive());

	function combineBuckets(...buckets: QueueBucket[]): QueueBucket {
		const byType: Record<string, number> = {};
		for (const bucket of buckets) {
			for (const [type, count] of Object.entries(bucket.by_type)) {
				byType[type] = (byType[type] ?? 0) + count;
			}
		}
		return {
			total: buckets.reduce((total, bucket) => total + bucket.total, 0),
			by_type: byType,
			items: buckets.flatMap((bucket) => bucket.items)
		};
	}

	function breakdown(bucket: QueueBucket): string {
		const parts = Object.entries(bucket.by_type)
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.map(([type, count]) => {
				const label = typeLabel(type).toLowerCase();
				return `${count} ${label}${count === 1 ? '' : 's'}`;
			});
		return parts.join(' · ') || 'No queued work';
	}

	function itemStatus(item: QueueItem): string | undefined {
		return item.status ?? item.execution_state;
	}

	function itemHref(item: QueueItem): null | undefined {
		return item.type && !linkedTypes.has(item.type) ? null : undefined;
	}
</script>

{#snippet bucketList(bucket: QueueBucket, emptyTitle: string, emptyDescription: string)}
	{#if bucket.items.length}
		<div class="-my-2">
			{#each bucket.items as item, index (item.id ?? index)}
				<WorkItemRow
					type={item.type ?? 'work'}
					id={item.id ?? `unknown-${index}`}
					title={item.title ?? item.id ?? 'Untitled Work'}
					status={itemStatus(item)}
					why={item.why}
					href={itemHref(item)}
				/>
			{/each}
			{#if bucket.total > bucket.items.length}
				<a
					href={browseHref}
					class="falcon-focus touch-target mt-2 inline-flex rounded text-[length:var(--text-label)] font-semibold text-primary hover:text-primary/80"
				>
					+{bucket.total - bucket.items.length} more → Browse
				</a>
			{/if}
		</div>
	{:else}
		<EmptyState title={emptyTitle} description={emptyDescription} />
	{/if}
{/snippet}

<svelte:head><title>Mission Control — Work v3</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-6">
	<header class="space-y-2 border-b border-outline-variant pb-5">
		<p
			class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
		>
			Operator cockpit
		</p>
		<h1
			class="text-[length:var(--md-sys-typescale-headline-medium-size)] font-semibold leading-tight text-on-surface"
		>
			Mission Control
		</h1>
		<p class="max-w-3xl text-[length:var(--text-body)] leading-relaxed text-on-surface-variant">
			The smallest set of calls, risks, and next actions that can materially advance Work.
		</p>
	</header>

	<section aria-label="Queue summary" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<StatTile
			label="Needs your call"
			value={queue.needs_fred.total}
			breakdown={breakdown(queue.needs_fred)}
			description="Decisions, questions, and outputs waiting on you."
			href="#needs-fred"
			tone="warning"
		/>
		<StatTile
			label="At risk"
			value={queue.at_risk.total}
			breakdown={breakdown(queue.at_risk)}
			description="Blocked work, unhealthy automation, and reconciliation gaps."
			href="#at-risk"
			tone="danger"
		/>
		<StatTile
			label="Agent can act"
			value={queue.actionable_now.total}
			breakdown={breakdown(queue.actionable_now)}
			description="Owned work that can advance without a human call."
			href="#agent-can-act"
			tone="active"
		/>
		<StatTile
			label="Waiting"
			value={waiting.total}
			breakdown={breakdown(waiting)}
			description="Work waiting on an agent or an external party."
			href="#waiting"
			tone="muted"
		/>
	</section>

	<Section
		id="needs-fred"
		title="Needs Fred"
		description="Authority, knowledge, or review needed from the operator."
		accent="warning"
	>
		{@render bucketList(
			queue.needs_fred,
			'Nothing needs your call',
			'No Decisions, Questions, or reviewed outputs are waiting on you.'
		)}
	</Section>

	<Section
		id="at-risk"
		title="At-risk breakdown"
		description="The combined risk total, separated by the kind of intervention it needs."
		accent="danger"
	>
		<nav aria-label="At-risk queues" class="grid gap-2 sm:grid-cols-3">
			<a
				href="#blocked-risk"
				class="falcon-focus touch-target flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] bg-surface-container-high px-4 py-3 text-on-surface hover:text-primary"
			>
				<span class="font-semibold">Blocked work</span>
				<span class="font-mono">{queue.blocked_risk.total}</span>
			</a>
			<a
				href="#automation-health"
				class="falcon-focus touch-target flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] bg-surface-container-high px-4 py-3 text-on-surface hover:text-primary"
			>
				<span class="font-semibold">Automation health</span>
				<span class="font-mono">{queue.unhealthy_automata.total}</span>
			</a>
			<a
				href="#reconciliation"
				class="falcon-focus touch-target flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] bg-surface-container-high px-4 py-3 text-on-surface hover:text-primary"
			>
				<span class="font-semibold">Reconciliation</span>
				<span class="font-mono">{queue.needs_reconciliation.total}</span>
			</a>
		</nav>
	</Section>

	<Section
		id="blocked-risk"
		title="Blocked risk"
		description="Explicit blockers on work that would otherwise be actionable."
		accent="danger"
	>
		{@render bucketList(
			queue.blocked_risk,
			'No blocked risk',
			'No active blockers are preventing actionable Work.'
		)}
	</Section>

	<Section
		id="governance"
		title="Governance"
		description="Reviews evaluate work; Authorization and Verification govern whether changes may proceed."
		accent="purple"
	>
		<div class="grid gap-4 lg:grid-cols-2">
			<section
				class="rounded-[var(--md-sys-shape-corner-medium)] border border-status-info/45 bg-surface-container-high p-4"
				aria-labelledby="awaiting-review-title"
			>
				<h3 id="awaiting-review-title" class="font-semibold text-on-surface">Awaiting Review</h3>
				<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
					Submitted Plan revisions awaiting evaluation. Review is not execution authority.
				</p>
				<div class="mt-3">
					{@render bucketList(
						queue.awaiting_review,
						'No Reviews waiting',
						'Every submitted Plan revision has a Review disposition.'
					)}
				</div>
			</section>
			<section
				class="rounded-[var(--md-sys-shape-corner-medium)] border border-status-warning/45 bg-surface-container-high p-4"
				aria-labelledby="authorization-verification-title"
			>
				<h3 id="authorization-verification-title" class="font-semibold text-on-surface">
					Needs Authorization / Verification
				</h3>
				<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
					Change controls that must be satisfied before execution or closeout.
				</p>
				<div class="mt-3">
					{@render bucketList(
						queue.changes_needing_authorization_or_verification,
						'No governance gates waiting',
						'No Change currently needs Authorization or Verification.'
					)}
				</div>
			</section>
		</div>
	</Section>

	<Section
		id="waiting"
		title="Waiting"
		description="Separate agent handoffs from dependencies outside the agent system."
	>
		<Tabs
			items={[
				{ value: 'agent', label: 'Agent', count: queue.waiting_on_agent.total },
				{ value: 'external', label: 'External', count: queue.waiting_on_external.total }
			]}
			bind:value={waitingTab}
			label="Waiting queue"
		>
			{#snippet children(activeTab)}
				{#if activeTab === 'agent'}
					{@render bucketList(
						queue.waiting_on_agent,
						'No agent handoffs waiting',
						'No Work is waiting on another agent or bot.'
					)}
				{:else}
					{@render bucketList(
						queue.waiting_on_external,
						'No external dependencies waiting',
						'No Work is waiting on a person, vendor, event, or external system.'
					)}
				{/if}
			{/snippet}
		</Tabs>
	</Section>

	<Section
		id="agent-can-act"
		title="Agent can act"
		description="Unblocked owned tasks ready to advance now."
		accent="info"
	>
		{@render bucketList(
			queue.actionable_now,
			'No agent-ready Work',
			'No owned Task is currently ready or in progress without a blocker.'
		)}
	</Section>

	<Section
		id="automation-health"
		title="Automation health"
		description="Automata with failing runs or an unreachable runtime."
		accent="danger"
	>
		{@render bucketList(
			queue.unhealthy_automata,
			'Automation is healthy',
			'All reachable Automata report healthy execution.'
		)}
	</Section>

	<Section
		id="reconciliation"
		title="Reconciliation"
		description="Structural inconsistencies that need the operator or an agent to restore coherence."
		accent="warning"
	>
		{@render bucketList(
			queue.needs_reconciliation,
			'No reconciliation needed',
			'Project next actions and evidence relationships are internally consistent.'
		)}
	</Section>

	<Section
		id="recent-changes"
		title="Material recent changes"
		description="Meaningful state transitions and authority acts, excluding routine edit noise."
	>
		{#if recentEvents.length}
			<Timeline events={recentEvents} />
		{:else}
			<EmptyState
				title="No material changes yet"
				description="Material command history will appear here as Work advances."
			/>
		{/if}
	</Section>
</div>
