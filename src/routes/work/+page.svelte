<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { EmptyState, Section, Timeline, WorkItemRow } from '$lib/components/work/index.js';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible/index.js';
	import { Tabs } from '$lib/components/ui/tabs/index.js';
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
	const atRisk = $derived(
		combineBuckets(queue.blocked_risk, queue.unhealthy_automata, queue.needs_reconciliation)
	);
	const waitingTotal = $derived(queue.waiting_on_agent.total + queue.waiting_on_external.total);
	const governanceTotal = $derived(
		queue.awaiting_review.total + queue.changes_needing_authorization_or_verification.total
	);
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
	let inMotionOpen = $state(false);

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

	function itemStatus(item: QueueItem): string | undefined {
		return item.status ?? item.execution_state;
	}

	function itemHref(item: QueueItem): null | undefined {
		return item.type && !linkedTypes.has(item.type) ? null : undefined;
	}
</script>

{#snippet bucketList(bucket: QueueBucket, emptyTitle: string)}
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
		<EmptyState title={emptyTitle} compact />
	{/if}
{/snippet}

<svelte:head><title>Work — Falcon Dash</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<h1 class="sr-only">Work</h1>

	<Section
		id="needs-your-call"
		title="Needs your call"
		count={queue.needs_fred.total}
		accent="warning"
	>
		{@render bucketList(queue.needs_fred, 'Nothing needs your call.')}
	</Section>

	<Section id="at-risk" title="At risk" count={atRisk.total} accent="danger">
		{@render bucketList(atRisk, 'Nothing at risk.')}
	</Section>

	{#if governanceTotal > 0}
		<Section id="governance" title="Governance" count={governanceTotal} accent="purple">
			<div class="grid gap-4 lg:grid-cols-2">
				{#if queue.awaiting_review.total > 0}
					<section aria-labelledby="awaiting-review-title">
						<h3 id="awaiting-review-title" class="mb-2 font-medium text-on-surface">
							Awaiting review
							<span class="font-normal text-on-surface-variant">
								({queue.awaiting_review.total})
							</span>
						</h3>
						{@render bucketList(queue.awaiting_review, 'No reviews waiting.')}
					</section>
				{/if}
				{#if queue.changes_needing_authorization_or_verification.total > 0}
					<section aria-labelledby="authorization-verification-title">
						<h3 id="authorization-verification-title" class="mb-2 font-medium text-on-surface">
							Needs authorization or verification
							<span class="font-normal text-on-surface-variant">
								({queue.changes_needing_authorization_or_verification.total})
							</span>
						</h3>
						{@render bucketList(
							queue.changes_needing_authorization_or_verification,
							'No gates waiting.'
						)}
					</section>
				{/if}
			</div>
		</Section>
	{/if}

	<Collapsible bind:open={inMotionOpen}>
		<section
			class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container shadow-none"
			aria-label="In motion"
		>
			<h2 class="m-0">
				<CollapsibleTrigger
					class="falcon-focus touch-target flex w-full items-center justify-between px-4 py-4 text-left sm:px-5"
				>
					<span class="font-semibold text-on-surface">
						In motion
						<span class="ml-1.5 font-normal text-on-surface-variant">
							({queue.actionable_now.total} agent · {waitingTotal} waiting)
						</span>
					</span>
					<span class="text-[length:var(--text-label)] font-semibold text-primary">
						{inMotionOpen ? 'Collapse' : 'Expand'}
					</span>
				</CollapsibleTrigger>
			</h2>
			<CollapsibleContent>
				<div class="space-y-5 border-t border-outline-variant/70 p-4 sm:p-5">
					<section aria-labelledby="agent-can-act-title">
						<h3 id="agent-can-act-title" class="mb-2 font-medium text-on-surface">
							Agent can act
							<span class="font-normal text-on-surface-variant">
								({queue.actionable_now.total})
							</span>
						</h3>
						{@render bucketList(queue.actionable_now, 'No agent-ready work.')}
					</section>
					<section aria-labelledby="waiting-title">
						<h3 id="waiting-title" class="mb-2 font-medium text-on-surface">
							Waiting
							<span class="font-normal text-on-surface-variant">({waitingTotal})</span>
						</h3>
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
									{@render bucketList(queue.waiting_on_agent, 'Nothing waiting on an agent.')}
								{:else}
									{@render bucketList(
										queue.waiting_on_external,
										'Nothing waiting on an external party.'
									)}
								{/if}
							{/snippet}
						</Tabs>
					</section>
				</div>
			</CollapsibleContent>
		</section>
	</Collapsible>

	<Section id="recent-activity" title="Recent activity">
		{#if recentEvents.length}
			<Timeline events={recentEvents} />
		{:else}
			<EmptyState title="No activity yet." compact />
		{/if}
	</Section>
</div>
