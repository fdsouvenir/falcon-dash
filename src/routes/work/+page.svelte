<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { EmptyState, StatTile, Timeline, WorkGlyph } from '$lib/components/work/index.js';
	import { STATUS_COLORS } from '$lib/components/ui/design-tokens.js';
	import { typeLabel, workHref } from '$lib/work3/hrefs.js';
	import { toneFor } from '$lib/work3/tones.js';
	import { connectWorkQueueLive } from '$lib/work3/live.js';
	import type { PageData } from './$types.js';

	interface QueueItem {
		id?: string;
		type?: string;
		title?: string;
		status?: string;
		execution_state?: string;
		why?: string;
		due_at?: number;
		project_id?: string;
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

	interface PanelGroup {
		title: string;
		count: number;
		items: QueueItem[];
		empty: string;
		moreHref?: string;
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
	const dueNext = $derived(data.dueNext as unknown as QueueBucket & { overdue_total: number });
	const recentSummary = $derived(
		data.recentSummary as { total: number; by_type: Record<string, number> }
	);
	const browseHref = resolve('/work/browse');
	const needsResolutionHref = resolve('/work/needs-resolution');
	const now = Date.now();

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

	onMount(() => connectWorkQueueLive());

	// --- formatting -----------------------------------------------------------

	function formatStatus(value: string | undefined): string {
		if (!value) return '';
		const text = value.replaceAll('_', ' ');
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function statusToneClass(item: QueueItem): string {
		const status = item.status ?? item.execution_state;
		const toneType =
			item.type === 'change_request' || item.type === 'change'
				? 'change_execution'
				: (item.type ?? 'task');
		return STATUS_COLORS[toneFor(toneType, status)].text;
	}

	function rowHref(item: QueueItem): string | undefined {
		if (item.type === 'milestone' && item.project_id) {
			return workHref('project', item.project_id);
		}
		if (!item.type || !linkedTypes.has(item.type)) return undefined;
		return workHref(item.type, item.id ?? '');
	}

	// Short scannable reason for the row meta line — long rationale prose
	// (Decision consequences, blocker reasons) belongs on the detail page.
	function reasonText(item: QueueItem): string {
		if (item.type === 'decision') {
			return item.status === 'deferred' ? 'Deferred' : 'Needs decision';
		}
		if (item.type === 'question' || item.type === 'open_question') return 'Needs answer';
		if (item.status === 'in_review') return 'Needs review';
		const reason = item.why ?? formatStatus(item.status ?? item.execution_state) ?? '';
		return reason.length > 80 ? `${reason.slice(0, 77)}…` : reason;
	}

	function typeBreakdown(byType: Record<string, number>, empty: string): string {
		const entries = Object.entries(byType).sort(
			(left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
		);
		const parts = entries
			.slice(0, 4)
			.map(([type, count]) => `${count} ${typeLabel(type).toLowerCase()}${count === 1 ? '' : 's'}`);
		if (entries.length > 4) parts.push(`+${entries.length - 4} more`);
		return parts.join(' · ') || empty;
	}

	// --- KPI signals ----------------------------------------------------------

	const waitingTotal = $derived(queue.waiting_on_agent.total + queue.waiting_on_external.total);
	const riskTotal = $derived(
		queue.blocked_risk.total +
			queue.unhealthy_automata.total +
			queue.needs_reconciliation.total +
			waitingTotal
	);
	const riskBreakdown = $derived.by(() => {
		const parts: string[] = [];
		if (queue.blocked_risk.total) parts.push(`${queue.blocked_risk.total} blocked`);
		if (queue.unhealthy_automata.total)
			parts.push(
				`${queue.unhealthy_automata.total} automation${queue.unhealthy_automata.total === 1 ? '' : 's'}`
			);
		if (queue.needs_reconciliation.total)
			parts.push(`${queue.needs_reconciliation.total} to reconcile`);
		if (waitingTotal) parts.push(`${waitingTotal} waiting`);
		return parts.join(' · ') || 'Nothing at risk';
	});
	const overdueCount = $derived(dueNext.overdue_total);
	const dueBreakdown = $derived.by(() => {
		const byType = typeBreakdown(dueNext.by_type, 'No near-term dates');
		return overdueCount > 0 ? `${overdueCount} overdue · ${byType}` : byType;
	});

	// --- Due next windows -----------------------------------------------------

	function endOfDay(base: number, daysAhead = 0): number {
		const day = new Date(base + daysAhead * 24 * 60 * 60 * 1000);
		return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).getTime();
	}
	// Week runs through Sunday, like the v2 timeline buckets.
	const daysUntilSunday = (7 - new Date(now).getDay()) % 7;
	const todayEnd = endOfDay(now);
	const weekEnd = endOfDay(now, daysUntilSunday);
	const nextWeekEnd = endOfDay(now, daysUntilSunday + 7);

	const dueWindows = $derived.by(() => {
		const windows = [
			{ title: 'Today', items: [] as QueueItem[] },
			{ title: 'This week', items: [] as QueueItem[] },
			{ title: 'Next week', items: [] as QueueItem[] },
			{ title: 'Later', items: [] as QueueItem[] }
		];
		for (const item of dueNext.items) {
			const due = Number(item.due_at);
			if (due <= todayEnd) windows[0].items.push(item);
			else if (due <= weekEnd) windows[1].items.push(item);
			else if (due <= nextWeekEnd) windows[2].items.push(item);
			else windows[3].items.push(item);
		}
		return windows;
	});

	function dueDateLabel(item: QueueItem): string {
		const due = Number(item.due_at);
		const label = new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `Due ${label}`;
	}

	// --- Panels ---------------------------------------------------------------

	const needsCallGroups = $derived.by<PanelGroup[]>(() => [
		{
			title: 'Decisions',
			count: queue.needs_fred_decisions.total,
			items: queue.needs_fred_decisions.items,
			empty: 'No decisions waiting',
			moreHref: needsResolutionHref
		},
		{
			title: 'Questions',
			count: queue.needs_fred_questions.total,
			items: queue.needs_fred_questions.items,
			empty: 'No open questions',
			moreHref: needsResolutionHref
		},
		{
			title: 'Review outputs',
			count: queue.needs_fred_review.total,
			items: queue.needs_fred_review.items,
			empty: 'No outputs to review',
			moreHref: needsResolutionHref
		},
		{
			title: 'Plan reviews',
			count: queue.awaiting_review.total,
			items: queue.awaiting_review.items,
			empty: 'No plan reviews waiting',
			moreHref: needsResolutionHref
		},
		{
			title: 'Authorization / verification',
			count: queue.changes_needing_authorization_or_verification.total,
			items: queue.changes_needing_authorization_or_verification.items,
			empty: 'No change gates waiting',
			moreHref: needsResolutionHref
		}
	]);

	// Blocked work lives with the operator asks: unblocking is Fred's job.
	const blockedGroup = $derived.by<PanelGroup>(() => ({
		title: 'Blocked on you',
		count: queue.blocked_risk.total,
		items: queue.blocked_risk.items,
		empty: 'No blocked work',
		moreHref: browseHref
	}));

	const agentGroups = $derived.by<PanelGroup[]>(() => [
		{
			title: 'Working now',
			count: queue.actionable_now.total,
			items: queue.actionable_now.items,
			empty: 'No agent-ready work',
			moreHref: browseHref
		},
		{
			title: 'Waiting',
			count: waitingTotal,
			items: [...queue.waiting_on_agent.items, ...queue.waiting_on_external.items],
			empty: 'Nothing waiting',
			moreHref: browseHref
		},
		{
			title: 'Automations',
			count: queue.unhealthy_automata.total,
			items: queue.unhealthy_automata.items,
			empty: 'All automations healthy',
			moreHref: resolve('/work/automations')
		},
		{
			title: 'Reconciliation',
			count: queue.needs_reconciliation.total,
			items: queue.needs_reconciliation.items,
			empty: 'Nothing to reconcile',
			moreHref: browseHref
		}
	]);
</script>

{#snippet groupRows(group: PanelGroup)}
	<div class="divide-y divide-outline-variant/30 md:border-l md:border-outline-variant/35">
		{#each group.items.slice(0, 4) as item, index (item.id ?? index)}
			{@const href = rowHref(item)}
			<svelte:element
				this={href ? 'a' : 'div'}
				{href}
				class="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-high/50 {href
					? 'falcon-focus'
					: ''}"
			>
				<WorkGlyph type={item.type ?? 'work'} />
				<div class="min-w-0 flex-1">
					<div
						class="flex min-w-0 items-baseline gap-2 overflow-hidden text-[length:var(--text-label)]"
					>
						<span class="shrink-0 font-mono text-on-surface-variant/80">{item.id}</span>
						<span class="min-w-0 truncate {statusToneClass(item)}">{reasonText(item)}</span>
					</div>
					<p class="mt-0.5 truncate text-[length:var(--text-body)] font-semibold text-on-surface">
						{item.title ?? item.id}
					</p>
				</div>
			</svelte:element>
		{:else}
			{#if group.count === 0}
				<p class="px-4 py-3 text-[length:var(--text-body)] text-on-surface-variant">
					{group.empty}
				</p>
			{/if}
		{/each}
		{#if group.count > Math.min(group.items.length, 4) && group.moreHref}
			<a
				href={group.moreHref}
				class="falcon-focus block px-4 py-2 text-[length:var(--text-label)] font-semibold text-primary hover:bg-surface-container-high/50"
			>
				+{group.count - Math.min(group.items.length, 4)} more
			</a>
		{/if}
	</div>
{/snippet}

{#snippet groupedPanel(id: string, heading: string, groups: PanelGroup[], accent: boolean = false)}
	<div
		{id}
		tabindex="-1"
		class="scroll-mt-24 overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/55 bg-surface-container shadow-none"
	>
		<div class="flex items-center gap-2.5 border-b border-outline-variant/45 px-4 py-3">
			{#if accent}
				<span class="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true"></span>
			{/if}
			<h2 class="text-lg font-semibold {accent ? 'text-primary' : 'text-on-surface'}">{heading}</h2>
		</div>
		<div class="divide-y divide-outline-variant/35">
			{#each groups as group (group.title)}
				<div class="grid gap-0 md:grid-cols-[11rem_minmax(0,1fr)]">
					<div class="border-b border-outline-variant/25 px-4 py-3 md:border-b-0">
						<div class="flex items-center justify-between gap-3 md:block">
							<h3 class="text-[length:var(--text-body)] font-semibold text-on-surface">
								{group.title}
							</h3>
							<span class="text-[length:var(--text-body)] font-semibold text-on-surface md:hidden">
								{group.count}
							</span>
						</div>
					</div>
					{@render groupRows(group)}
				</div>
			{/each}
		</div>
	</div>
{/snippet}

<svelte:head><title>Work — Falcon Dash</title></svelte:head>

<div class="space-y-4">
	<h1 class="sr-only">Work</h1>

	<section
		class="overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/55 bg-surface-container shadow-[0_10px_30px_rgba(0,0,0,0.14)]"
		aria-label="Signals"
	>
		<div
			class="grid divide-y divide-outline-variant/45 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4"
		>
			<div class="signal-cell">
				<StatTile
					bare
					label="Needs your call"
					value={queue.needs_fred.total}
					breakdown={typeBreakdown(queue.needs_fred.by_type, 'No operator asks')}
					href="#needs-you"
					tone="warning"
				/>
			</div>
			<div class="signal-cell">
				<StatTile
					bare
					label="At risk"
					value={riskTotal}
					breakdown={riskBreakdown}
					href="#needs-you"
					tone="danger"
				/>
			</div>
			<div class="signal-cell">
				<StatTile
					bare
					label="Due next"
					value={dueNext.total}
					breakdown={dueBreakdown}
					href="#due-next"
					tone="info"
				/>
			</div>
			<div class="signal-cell">
				<StatTile
					bare
					label="Changed recently"
					value={recentSummary.total}
					breakdown={typeBreakdown(recentSummary.by_type, 'No recent updates')}
					href="#recent"
					tone="primary"
				/>
			</div>
		</div>
	</section>

	<section
		id="due-next"
		tabindex="-1"
		class="scroll-mt-24 overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/55 bg-surface-container shadow-none"
	>
		<div class="border-b border-outline-variant/45 px-4 py-3">
			<h2 class="text-lg font-semibold text-on-surface">Due next</h2>
		</div>
		<div class="grid divide-y divide-outline-variant/35 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
			{#each dueWindows as window (window.title)}
				<div class="min-w-0">
					<div class="flex items-baseline justify-between gap-3 px-4 py-3">
						<h3 class="text-[length:var(--text-body)] font-semibold text-on-surface">
							{window.title}
						</h3>
						<p class="text-[length:var(--text-label)] text-on-surface-variant">
							{window.items.length} item{window.items.length === 1 ? '' : 's'}
						</p>
					</div>
					<div class="divide-y divide-outline-variant/30 px-3 pb-3">
						{#each window.items.slice(0, 4) as item (item.id)}
							{@const href = rowHref(item)}
							<svelte:element
								this={href ? 'a' : 'div'}
								{href}
								class="block rounded-[var(--md-sys-shape-corner-small)] border border-outline-variant/45 bg-surface-container-low p-3 hover:bg-surface-container-high/50 {href
									? 'falcon-focus'
									: ''}"
							>
								<div class="flex min-w-0 items-center gap-2.5">
									<WorkGlyph type={item.type ?? 'work'} size={24} />
									<span
										class="font-mono text-[length:var(--text-label)] text-on-surface-variant/80"
									>
										{item.id}
									</span>
									<span
										class="ml-auto rounded-full border border-current/45 px-2 py-0.5 text-[length:var(--text-badge)] font-medium {statusToneClass(
											item
										)}"
									>
										{formatStatus(item.status ?? item.execution_state)}
									</span>
								</div>
								<p
									class="mt-2 line-clamp-2 text-[length:var(--text-body)] font-semibold leading-5 text-on-surface"
								>
									{item.title ?? item.id}
								</p>
								<p
									class="mt-1.5 font-mono text-[length:var(--text-label)] leading-5 {Number(
										item.due_at
									) < now
										? 'text-status-danger'
										: 'text-on-surface-variant'}"
								>
									{dueDateLabel(item)}
								</p>
							</svelte:element>
						{:else}
							<div
								class="flex min-h-24 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] border border-dashed border-outline-variant/55"
							>
								<p class="text-[length:var(--text-body)] text-on-surface-variant">Nothing due.</p>
							</div>
						{/each}
						{#if window.items.length > 4}
							<a
								href={window.title === 'Today'
									? `${browseHref}?type=task&focus=overdue`
									: `${browseHref}?type=task`}
								class="falcon-focus block rounded px-1 py-2 text-[length:var(--text-label)] font-semibold text-primary"
							>
								+{window.items.length - 4} more
							</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="grid gap-4 xl:grid-cols-[5fr_4fr]" aria-label="Queues">
		{@render groupedPanel('needs-you', 'Needs your call', [...needsCallGroups, blockedGroup], true)}
		{@render groupedPanel('agent-activity', 'Agent activity', agentGroups)}
	</section>

	<section
		id="recent"
		tabindex="-1"
		class="scroll-mt-24 overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/55 bg-surface-container shadow-none"
	>
		<div class="border-b border-outline-variant/45 px-4 py-3">
			<h2 class="text-lg font-semibold text-on-surface">Recent activity</h2>
		</div>
		<div class="p-4 sm:p-5">
			{#if recentEvents.length}
				<Timeline events={recentEvents} />
			{:else}
				<EmptyState title="No activity yet." compact />
			{/if}
		</div>
	</section>
</div>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.signal-cell {
			animation: signal-in var(--md-sys-motion-duration-medium2, 300ms)
				var(--md-sys-motion-easing-standard, ease-out) both;
		}
		.signal-cell:nth-child(2) {
			animation-delay: 60ms;
		}
		.signal-cell:nth-child(3) {
			animation-delay: 120ms;
		}
		.signal-cell:nth-child(4) {
			animation-delay: 180ms;
		}
	}
	@keyframes signal-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
</style>
