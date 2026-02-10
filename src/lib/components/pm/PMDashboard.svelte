<script lang="ts">
	import {
		getPMStats,
		getDashboardContext,
		type PMStats,
		type DashboardContext,
		type Activity
	} from '$lib/stores/pm-operations.js';

	let stats = $state<PMStats | null>(null);
	let context = $state<DashboardContext | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		loadDashboard();
	});

	async function loadDashboard() {
		loading = true;
		error = null;
		try {
			const [s, c] = await Promise.all([getPMStats(), getDashboardContext()]);
			stats = s;
			context = c;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp * 1000;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}

	function formatDueDate(dueDate: string): string {
		const date = new Date(dueDate);
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		const days = Math.ceil(diff / 86400000);

		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days < 0) return 'overdue';
		return `in ${days}d`;
	}
</script>

<div class="flex h-full flex-col gap-4 overflow-auto p-6">
	{#if loading}
		<div class="flex items-center justify-center py-12 text-gray-400">Loading dashboard...</div>
	{:else if error}
		<div class="flex items-center justify-center py-12 text-red-400">Error: {error}</div>
	{:else if stats && context}
		<!-- Stats Header -->
		<div class="grid grid-cols-5 gap-3">
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<div class="text-xs text-gray-500">Total Projects</div>
				<div class="mt-1 text-2xl font-semibold text-white">{stats.totalProjects}</div>
			</div>
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<div class="text-xs text-gray-500">Active</div>
				<div class="mt-1 text-2xl font-semibold text-green-400">{context.activeProjects}</div>
			</div>
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<div class="text-xs text-gray-500">Due Soon</div>
				<div class="mt-1 text-2xl font-semibold text-yellow-400">{context.dueSoon.length}</div>
			</div>
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<div class="text-xs text-gray-500">Blocked</div>
				<div class="mt-1 text-2xl font-semibold text-orange-400">{context.blocked.length}</div>
			</div>
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<div class="text-xs text-gray-500">Overdue</div>
				<div class="mt-1 text-2xl font-semibold text-red-400">{stats.overdue}</div>
			</div>
		</div>

		<!-- Main Content Grid -->
		<div class="grid grid-cols-2 gap-4">
			<!-- Due Soon Section -->
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-3 text-sm font-semibold text-white">Due Soon (Next 7 Days)</h2>
				{#if context.dueSoon.length === 0}
					<div class="py-4 text-sm text-gray-500">No items due soon</div>
				{:else}
					<div class="space-y-2">
						{#each context.dueSoon as item}
							<div class="rounded border border-gray-700 bg-gray-900 p-3">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="text-sm text-white">{item.title}</div>
										<div class="mt-1 flex items-center gap-2">
											<span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400"
												>{item.type}</span
											>
											<span class="text-xs text-gray-500">{formatDueDate(item.due_date)}</span>
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- In Progress Section -->
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-3 text-sm font-semibold text-white">In Progress</h2>
				<div class="space-y-2">
					{#if stats.byStatus.in_progress}
						<div class="rounded border border-gray-700 bg-gray-900 p-3">
							<div class="text-sm text-white">Active Tasks</div>
							<div class="mt-2 flex items-center gap-2">
								<div class="h-1.5 flex-1 rounded-full bg-gray-700">
									<div
										class="h-full rounded-full bg-blue-500"
										style="width: {Math.round(
											(stats.byStatus.done / (stats.byStatus.done + stats.byStatus.in_progress)) *
												100
										)}%"
									></div>
								</div>
								<span class="text-xs text-gray-400"
									>{Math.round(
										(stats.byStatus.done / (stats.byStatus.done + stats.byStatus.in_progress)) * 100
									)}%</span
								>
							</div>
							<div class="mt-1 text-xs text-gray-500">
								{stats.byStatus.done} / {stats.byStatus.done + stats.byStatus.in_progress} tasks complete
							</div>
						</div>
					{:else}
						<div class="py-4 text-sm text-gray-500">No projects in progress</div>
					{/if}
				</div>
			</div>

			<!-- Blocked Items Section -->
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-3 text-sm font-semibold text-white">Blocked Items</h2>
				{#if context.blocked.length === 0}
					<div class="py-4 text-sm text-gray-500">No blocked items</div>
				{:else}
					<div class="space-y-2">
						{#each context.blocked as item}
							<div class="rounded border border-gray-700 bg-gray-900 p-3">
								<div class="text-sm text-white">{item.title}</div>
								<div class="mt-1 text-xs text-gray-500">
									Blocked by {item.blockers.length} item{item.blockers.length !== 1 ? 's' : ''}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Recent Activity Section -->
			<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
				<h2 class="mb-3 text-sm font-semibold text-white">Recent Activity</h2>
				{#if context.recentActivity.length === 0}
					<div class="py-4 text-sm text-gray-500">No recent activity</div>
				{:else}
					<div class="space-y-2">
						{#each context.recentActivity as activity}
							<div class="border-b border-gray-700 pb-2 last:border-b-0">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="text-xs text-gray-400">
											<span class="text-white">{activity.actor}</span>
											{activity.action}
											<span class="text-white"
												>{activity.target_title || `#${activity.target_id}`}</span
											>
										</div>
										{#if activity.details}
											<div class="mt-1 text-xs text-gray-500">{activity.details}</div>
										{/if}
									</div>
									<div class="ml-2 text-xs text-gray-500">
										{formatRelativeTime(activity.created_at)}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
