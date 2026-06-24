<script lang="ts">
	import { onMount } from 'svelte';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';

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
		area_id: string | null;
		parent_item_id: number | null;
		title: string;
		description: string | null;
		body: string | null;
		status: WorkStatus;
		owner: string | null;
		waiting_on: string | null;
		priority: 'low' | 'normal' | 'high' | 'urgent' | null;
		next_action: string | null;
		approval_required: number;
		due_date: string | null;
		scheduled_at: string | null;
		result: string | null;
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

	const queueBuckets: Array<{ key: keyof WorkQueue; label: string; tone: string }> = [
		{ key: 'nextActions', label: 'Next action', tone: 'text-status-active' },
		{ key: 'needsReview', label: 'Review', tone: 'text-status-warning' },
		{ key: 'waitingOnFred', label: 'Fred', tone: 'text-status-info' },
		{ key: 'waitingOnAgent', label: 'Agent', tone: 'text-status-muted' },
		{ key: 'blockedRisky', label: 'Risk', tone: 'text-status-danger' },
		{ key: 'scheduledRoutines', label: 'Routine', tone: 'text-status-purple' }
	];

	const typeFilters: Array<WorkItemType | 'all'> = [
		'all',
		'project',
		'change',
		'decision',
		'task',
		'routine',
		'observation',
		'area'
	];

	const statusFilters: Array<WorkStatus | 'open' | 'all'> = [
		'open',
		'in_progress',
		'needs_review',
		'waiting',
		'blocked',
		'planning',
		'ready',
		'scheduled',
		'complete',
		'all'
	];

	let loading = $state(true);
	let error = $state<string | null>(null);
	let items = $state<WorkItem[]>([]);
	let queue = $state<WorkQueue | null>(null);
	let selectedId = $state<number | null>(null);
	let search = $state('');
	let typeFilter = $state<WorkItemType | 'all'>('all');
	let statusFilter = $state<WorkStatus | 'open' | 'all'>('open');

	const openStatuses = new Set<WorkStatus>([
		'backlog',
		'planning',
		'ready',
		'in_progress',
		'waiting',
		'needs_review',
		'blocked',
		'scheduled'
	]);

	const openItems = $derived(items.filter((item) => openStatuses.has(item.status)));
	const selectedItem = $derived(items.find((item) => item.id === selectedId) ?? null);
	const filteredItems = $derived(
		items.filter((item) => {
			const query = search.trim().toLowerCase();
			const matchesSearch =
				!query ||
				item.title.toLowerCase().includes(query) ||
				item.description?.toLowerCase().includes(query) ||
				item.next_action?.toLowerCase().includes(query);
			const matchesType = typeFilter === 'all' || item.type === typeFilter;
			const matchesStatus =
				statusFilter === 'all' ||
				(statusFilter === 'open' ? openStatuses.has(item.status) : item.status === statusFilter);
			return matchesSearch && matchesType && matchesStatus;
		})
	);

	onMount(() => {
		void loadWork();
	});

	async function loadWork() {
		loading = true;
		error = null;
		try {
			const [itemsRes, queueRes] = await Promise.all([
				fetch('/api/work/items?limit=500&includeClosed=true'),
				fetch('/api/work/queue')
			]);
			if (!itemsRes.ok) throw new Error(`Items request failed: ${itemsRes.status}`);
			if (!queueRes.ok) throw new Error(`Queue request failed: ${queueRes.status}`);
			const itemsJson = await itemsRes.json();
			const queueJson = await queueRes.json();
			items = itemsJson.items ?? [];
			queue = queueJson.queue ?? null;
			selectedId = queue?.nextActions[0]?.id ?? items[0]?.id ?? null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load Work module';
		} finally {
			loading = false;
		}
	}

	function itemLabel(item: WorkItem): string {
		return `${formatType(item.type)} ${item.id}`;
	}

	function formatType(type: string): string {
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ');
	}

	function formatDate(value: number | string | null): string {
		if (!value) return '--';
		if (typeof value === 'number') return new Date(value * 1000).toLocaleString();
		return new Date(value).toLocaleDateString();
	}

	function statusTone(status: WorkStatus): string {
		if (status === 'in_progress' || status === 'ready') return 'text-status-active';
		if (status === 'needs_review' || status === 'waiting') return 'text-status-warning';
		if (status === 'blocked') return 'text-status-danger';
		if (status === 'complete') return 'text-status-info';
		return 'text-status-muted';
	}
</script>

<svelte:head>
	<title>Work - Falcon Dash</title>
</svelte:head>

<FalconModuleShell
	active="Work"
	eyebrow="Falcon Dash / Work Management"
	title="Work queue"
	description="Projects, Changes, Decisions, Routines, Observations, and Tasks in one active operating queue."
>
	<div class="space-y-4 p-4 sm:p-5">
		{#if loading}
			<div class="border border-surface-border bg-surface-1 p-4 text-sm text-status-muted">
				Loading Work...
			</div>
		{:else if error}
			<div
				class="border border-status-danger/40 bg-status-danger-bg p-4 text-sm text-status-danger"
			>
				{error}
			</div>
		{:else}
			<section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Open
					</p>
					<p class="mt-2 text-2xl font-semibold text-white">{openItems.length}</p>
				</div>
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Next
					</p>
					<p class="mt-2 text-2xl font-semibold text-status-active">
						{queue?.nextActions.length ?? 0}
					</p>
				</div>
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Review
					</p>
					<p class="mt-2 text-2xl font-semibold text-status-warning">
						{queue?.needsReview.length ?? 0}
					</p>
				</div>
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Waiting
					</p>
					<p class="mt-2 text-2xl font-semibold text-white">
						{(queue?.waitingOnFred.length ?? 0) + (queue?.waitingOnAgent.length ?? 0)}
					</p>
				</div>
			</section>

			<section class="grid gap-4 xl:grid-cols-[18rem_1fr_24rem]">
				<aside class="border border-surface-border bg-surface-1">
					<div class="border-b border-surface-border px-4 py-3">
						<h2 class="text-sm font-semibold text-white">Triage lanes</h2>
					</div>
					<div class="divide-y divide-surface-border">
						{#each queueBuckets as bucket (bucket.key)}
							<button
								type="button"
								class="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left transition hover:bg-surface-2"
								onclick={() => {
									selectedId = queue?.[bucket.key]?.[0]?.id ?? selectedId;
								}}
							>
								<span class="text-sm font-medium text-white">{bucket.label}</span>
								<span class="font-mono text-sm {bucket.tone}"
									>{queue?.[bucket.key]?.length ?? 0}</span
								>
							</button>
						{/each}
					</div>
					<button
						type="button"
						onclick={loadWork}
						class="m-4 border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						Refresh
					</button>
				</aside>

				<section class="min-w-0 border border-surface-border bg-surface-1">
					<div class="border-b border-surface-border p-3">
						<div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
							<input
								type="search"
								bind:value={search}
								placeholder="Search Work"
								class="min-h-10 border border-surface-border bg-surface-0 px-3 text-sm text-white placeholder-status-muted focus:border-white/40 focus:outline-none"
							/>
							<select
								bind:value={typeFilter}
								class="min-h-10 border border-surface-border bg-surface-0 px-3 text-sm text-white focus:border-white/40 focus:outline-none"
							>
								{#each typeFilters as value (value)}
									<option {value}>{value === 'all' ? 'All types' : formatType(value)}</option>
								{/each}
							</select>
							<select
								bind:value={statusFilter}
								class="min-h-10 border border-surface-border bg-surface-0 px-3 text-sm text-white focus:border-white/40 focus:outline-none"
							>
								{#each statusFilters as value (value)}
									<option {value}>{value === 'all' ? 'All status' : formatStatus(value)}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="divide-y divide-surface-border">
						{#each filteredItems as item (item.id)}
							<button
								type="button"
								class="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-surface-2 {selectedId ===
								item.id
									? 'bg-surface-2'
									: 'bg-surface-1'}"
								onclick={() => (selectedId = item.id)}
							>
								<div class="flex min-w-0 items-start justify-between gap-3">
									<div class="min-w-0">
										<p class="truncate text-sm font-semibold text-white">{item.title}</p>
										<p
											class="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-muted"
										>
											{itemLabel(item)}
										</p>
									</div>
									<span class="shrink-0 text-xs {statusTone(item.status)}">
										{formatStatus(item.status)}
									</span>
								</div>
								{#if item.next_action}
									<p class="line-clamp-2 text-xs leading-5 text-white/68">{item.next_action}</p>
								{/if}
							</button>
						{:else}
							<div class="p-4 text-sm text-status-muted">No Work items match this view.</div>
						{/each}
					</div>
				</section>

				<aside class="border border-surface-border bg-surface-1">
					{#if selectedItem}
						<div class="border-b border-surface-border px-4 py-3">
							<p
								class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted"
							>
								{itemLabel(selectedItem)}
							</p>
							<h2 class="mt-2 text-lg font-semibold leading-6 text-white">{selectedItem.title}</h2>
						</div>
						<div class="space-y-4 p-4">
							<div class="grid grid-cols-2 gap-px bg-surface-border">
								<div class="bg-surface-1 p-3">
									<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
										Status
									</p>
									<p class="mt-1 text-sm {statusTone(selectedItem.status)}">
										{formatStatus(selectedItem.status)}
									</p>
								</div>
								<div class="bg-surface-1 p-3">
									<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
										Priority
									</p>
									<p class="mt-1 text-sm text-white">{selectedItem.priority ?? 'normal'}</p>
								</div>
								<div class="bg-surface-1 p-3">
									<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
										Waiting
									</p>
									<p class="mt-1 text-sm text-white">{selectedItem.waiting_on ?? '--'}</p>
								</div>
								<div class="bg-surface-1 p-3">
									<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
										Updated
									</p>
									<p class="mt-1 text-sm text-white">{formatDate(selectedItem.last_activity_at)}</p>
								</div>
							</div>

							<div>
								<h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-status-muted">
									Next action
								</h3>
								<p class="mt-2 text-sm leading-6 text-white/75">
									{selectedItem.next_action ?? 'No next action set.'}
								</p>
							</div>

							{#if selectedItem.description}
								<div>
									<h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-status-muted">
										Description
									</h3>
									<p class="mt-2 text-sm leading-6 text-white/75">{selectedItem.description}</p>
								</div>
							{/if}

							{#if selectedItem.result}
								<div>
									<h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-status-muted">
										Result
									</h3>
									<p class="mt-2 text-sm leading-6 text-white/75">{selectedItem.result}</p>
								</div>
							{/if}

							<div class="grid gap-2 text-xs text-status-muted">
								<div>Owner: {selectedItem.owner ?? '--'}</div>
								<div>Due: {formatDate(selectedItem.due_date)}</div>
								<div>Scheduled: {formatDate(selectedItem.scheduled_at)}</div>
								<div>Approval: {selectedItem.approval_required ? 'required' : 'not required'}</div>
							</div>
						</div>
					{:else}
						<div class="p-4 text-sm text-status-muted">Select a Work item.</div>
					{/if}
				</aside>
			</section>
		{/if}
	</div>
</FalconModuleShell>
