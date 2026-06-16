<script lang="ts">
	import { onMount } from 'svelte';

	type WorkStatus =
		| 'backlog'
		| 'planning'
		| 'ready'
		| 'in_progress'
		| 'waiting'
		| 'needs_review'
		| 'blocked'
		| 'scheduled'
		| 'complete'
		| 'cancelled'
		| 'archived';

	type WorkItemType =
		| 'area'
		| 'project'
		| 'task'
		| 'decision'
		| 'routine'
		| 'observation'
		| 'change';

	interface WorkItem {
		id: number;
		type: WorkItemType;
		title: string;
		status: WorkStatus;
		priority: 'low' | 'normal' | 'high' | 'urgent' | null;
		waiting_on: string | null;
		next_action: string | null;
		due_date: string | null;
		last_activity_at: number;
	}

	interface WorkQueue {
		nextActions: WorkItem[];
		waitingOnFred: WorkItem[];
		waitingOnAgent: WorkItem[];
		needsReview: WorkItem[];
		scheduledRoutines: WorkItem[];
		staleCleanup: WorkItem[];
		blockedRisky: WorkItem[];
	}

	const queueBuckets: Array<{ key: keyof WorkQueue; label: string }> = [
		{ key: 'nextActions', label: 'Next Actions' },
		{ key: 'needsReview', label: 'Needs Review' },
		{ key: 'waitingOnFred', label: 'Waiting on Fred' },
		{ key: 'waitingOnAgent', label: 'Waiting on Agent' },
		{ key: 'blockedRisky', label: 'Blocked / Risky' },
		{ key: 'scheduledRoutines', label: 'Scheduled Routines' }
	];

	let loading = $state(true);
	let error = $state<string | null>(null);
	let items = $state<WorkItem[]>([]);
	let queue = $state<WorkQueue | null>(null);

	onMount(() => {
		void loadWork();
	});

	async function loadWork() {
		loading = true;
		error = null;
		try {
			const [itemsRes, queueRes] = await Promise.all([
				fetch('/api/work/items?limit=200&includeClosed=true'),
				fetch('/api/work/queue')
			]);
			if (!itemsRes.ok) throw new Error(`Items request failed: ${itemsRes.status}`);
			if (!queueRes.ok) throw new Error(`Queue request failed: ${queueRes.status}`);
			const itemsJson = await itemsRes.json();
			const queueJson = await queueRes.json();
			items = itemsJson.items ?? [];
			queue = queueJson.queue ?? null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load Work module';
		} finally {
			loading = false;
		}
	}

	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ');
	}

	function formatDate(value: number): string {
		return new Date(value * 1000).toLocaleString();
	}
</script>

<svelte:head>
	<title>Work - Falcon Dash</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden bg-surface-0">
	<div class="border-b border-surface-border bg-surface-1 px-5 py-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold text-white">Work</h1>
				<p class="mt-1 text-sm text-status-muted">
					New Falcon Dash source of truth. Legacy PM is migration input only.
				</p>
			</div>
			<button
				type="button"
				onclick={loadWork}
				class="rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/80 hover:bg-surface-3"
			>
				Refresh
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-5">
		{#if loading}
			<div class="text-sm text-status-muted">Loading Work...</div>
		{:else if error}
			<div
				class="rounded border border-status-error/40 bg-status-error/10 p-4 text-sm text-status-error"
			>
				{error}
			</div>
		{:else}
			<div class="grid gap-4 lg:grid-cols-3">
				<div class="lg:col-span-2">
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-status-muted">
						Queue
					</h2>
					<div class="grid gap-3 md:grid-cols-2">
						{#each queueBuckets as bucket (bucket.key)}
							<section class="rounded border border-surface-border bg-surface-1 p-3">
								<div class="mb-3 flex items-center justify-between">
									<h3 class="text-sm font-semibold text-white">{bucket.label}</h3>
									<span class="text-xs text-status-muted">{queue?.[bucket.key]?.length ?? 0}</span>
								</div>
								<div class="space-y-2">
									{#each (queue?.[bucket.key] ?? []).slice(0, 5) as item (item.id)}
										<div class="rounded border border-surface-border bg-surface-2 p-2">
											<div class="truncate text-sm font-medium text-white">{item.title}</div>
											<div class="mt-1 flex flex-wrap gap-2 text-xs text-status-muted">
												<span>{item.type}</span>
												<span>{formatStatus(item.status)}</span>
											</div>
										</div>
									{:else}
										<div class="text-xs text-status-muted">Empty</div>
									{/each}
								</div>
							</section>
						{/each}
					</div>
				</div>

				<div>
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-status-muted">
						Recent Items
					</h2>
					<section class="rounded border border-surface-border bg-surface-1">
						{#each items.slice(0, 30) as item (item.id)}
							<div class="border-b border-surface-border p-3 last:border-b-0">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium text-white">{item.title}</div>
										<div class="mt-1 text-xs text-status-muted">
											{item.type} / {formatStatus(item.status)}
										</div>
									</div>
									<span class="shrink-0 text-xs text-status-muted">#{item.id}</span>
								</div>
								{#if item.next_action}
									<div class="mt-2 text-xs text-white/70">{item.next_action}</div>
								{/if}
								<div class="mt-2 text-[11px] text-status-muted">
									Updated {formatDate(item.last_activity_at)}
								</div>
							</div>
						{:else}
							<div class="p-3 text-sm text-status-muted">No Work items yet.</div>
						{/each}
					</section>
				</div>
			</div>
		{/if}
	</div>
</div>
