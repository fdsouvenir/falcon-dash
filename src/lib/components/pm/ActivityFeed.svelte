<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Activity } from '$lib/stores/pm-operations.js';
	import { formatRelativeTime } from './pm-utils.js';

	interface Props {
		activities: Activity[];
		onPlanClick?: (planId: number) => void;
	}

	let { activities, onPlanClick }: Props = $props();

	// -------------------------------------------------------------------------
	// Rich event description
	// -------------------------------------------------------------------------

	function describeActivity(a: Activity): string {
		const title = a.target_title ? `"${a.target_title}"` : `#${a.target_id}`;
		const planRef = a.target_type === 'plan' ? `Plan ${title}` : null;

		switch (a.action) {
			case 'created':
				return `Project created`;
			case 'status_changed':
				return a.details ?? `Status changed`;
			case 'updated':
				// details contains "Field: old → new; ..." list
				return a.details ?? `Project updated`;
			case 'commented':
				return `Comment added`;
			case 'reopened':
				return `Project reopened`;
			case 'closed':
				return `Project closed`;
			case 'plan_created':
				return `${planRef} created`;
			case 'plan_updated':
				return `${planRef} updated`;
			case 'plan_status_changed':
				// details = "old → new"
				return `${planRef} status: ${a.details ?? 'changed'}`;
			default:
				return a.action.replaceAll('_', ' ');
		}
	}

	// Icon name per action for the small leading dot colour
	function actionColor(a: Activity): string {
		switch (a.action) {
			case 'created':
			case 'plan_created':
				return 'bg-status-active';
			case 'status_changed':
			case 'plan_status_changed':
				return 'bg-status-warning';
			case 'plan_updated':
			case 'updated':
				return 'bg-status-info';
			case 'commented':
				return 'bg-status-purple';
			case 'closed':
			case 'reopened':
				return 'bg-status-danger';
			default:
				return 'bg-status-muted';
		}
	}

	// -------------------------------------------------------------------------
	// Batch collapsing: group consecutive entries with same action + target_id
	// within a 60-second window.
	// -------------------------------------------------------------------------

	interface Group {
		key: string;
		items: Activity[];
		representative: Activity;
	}

	const BATCH_WINDOW_S = 60;

	const grouped = $derived.by(() => {
		const groups: Group[] = [];
		for (const item of activities) {
			const last = groups[groups.length - 1];
			const key = `${item.action}:${item.target_id}`;
			if (
				last &&
				last.key === key &&
				Math.abs(item.created_at - last.representative.created_at) <= BATCH_WINDOW_S
			) {
				last.items.push(item);
			} else {
				groups.push({ key, items: [item], representative: item });
			}
		}
		return groups;
	});

	// -------------------------------------------------------------------------
	// Expandable batches
	// -------------------------------------------------------------------------
	let expandedKeys = new SvelteSet<string>();

	function toggleExpand(key: string) {
		if (expandedKeys.has(key)) expandedKeys.delete(key);
		else expandedKeys.add(key);
	}

	function isClickablePlan(a: Activity): boolean {
		return a.target_type === 'plan' && !!onPlanClick;
	}
</script>

{#if grouped.length === 0}
	<div class="rounded-xl bg-surface-2 p-6 text-center text-status-muted text-sm">
		No activity recorded yet.
	</div>
{:else}
	<div class="rounded-xl bg-surface-2 divide-y divide-surface-border">
		{#each grouped as group (group.key + ':' + group.representative.created_at)}
			{@const rep = group.representative}
			{@const count = group.items.length}
			{@const expanded = expandedKeys.has(group.key + ':' + rep.created_at)}
			{@const isBatch = count > 1}
			{@const isplan = isClickablePlan(rep)}

			<!-- Primary row -->
			<div
				class="px-3 py-2 flex items-center gap-2.5 min-w-0 hover:bg-surface-3/30 transition-colors"
			>
				<!-- Colour dot -->
				<div class="w-1.5 h-1.5 rounded-full flex-shrink-0 {actionColor(rep)}"></div>

				<!-- Description -->
				<p class="flex-1 min-w-0 text-sm text-white truncate">
					{#if isBatch}
						<!-- Batch: show count + collapse toggle -->
						<button
							onclick={() => toggleExpand(group.key + ':' + rep.created_at)}
							class="text-left hover:text-status-info transition-colors"
						>
							{count}× {describeActivity(rep)}
						</button>
					{:else if isplan}
						<!-- Clickable plan link -->
						<button
							onclick={() => onPlanClick!(rep.target_id)}
							class="text-left hover:text-status-info transition-colors"
						>
							{describeActivity(rep)}
						</button>
					{:else}
						{describeActivity(rep)}
					{/if}
				</p>

				<!-- Relative timestamp -->
				<span class="flex-shrink-0 text-xs text-status-muted/70 tabular-nums">
					{formatRelativeTime(rep.created_at)}
				</span>

				<!-- Expand chevron for batches -->
				{#if isBatch}
					<button
						onclick={() => toggleExpand(group.key + ':' + rep.created_at)}
						class="flex-shrink-0 text-status-muted/50 hover:text-status-muted transition-colors"
					>
						<svg
							class="w-3 h-3 transition-transform {expanded ? 'rotate-180' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
				{/if}
			</div>

			<!-- Expanded batch items (skip first, already shown) -->
			{#if isBatch && expanded}
				{#each group.items.slice(1) as item (item.id)}
					<div
						class="px-3 py-1.5 flex items-center gap-2.5 min-w-0 bg-surface-0/40 border-l-2 border-surface-border"
					>
						<div class="w-1.5 h-1.5 rounded-full flex-shrink-0 {actionColor(item)}"></div>
						<p class="flex-1 min-w-0 text-xs text-white/70 truncate">
							{#if isClickablePlan(item)}
								<button
									onclick={() => onPlanClick!(item.target_id)}
									class="text-left hover:text-status-info transition-colors"
								>
									{describeActivity(item)}
								</button>
							{:else}
								{describeActivity(item)}
							{/if}
						</p>
						<span class="flex-shrink-0 text-xs text-status-muted/50 tabular-nums">
							{formatRelativeTime(item.created_at)}
						</span>
					</div>
				{/each}
			{/if}
		{/each}
	</div>
{/if}
