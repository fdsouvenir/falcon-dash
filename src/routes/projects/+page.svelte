<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PmStatus, PmPriority } from '$lib/types';
	import type { PmActivity } from '$lib/types';
	import {
		pmStats,
		pmTasks,
		pmActivities,
		pmBlocks,
		pmProjects,
		loadStats,
		loadActivities,
		loadProjects,
		loadBlocks,
		initPmListeners,
		destroyPmListeners
	} from '$lib/stores';

	// --- State ---
	let loading = true;
	let errorMessage = '';

	// --- Helpers ---

	function formatDate(ts: number): string {
		const d = new Date(ts);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString();
	}

	function formatDueDate(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const due = new Date(d);
		due.setHours(0, 0, 0, 0);
		const diff = due.getTime() - now.getTime();
		const days = Math.round(diff / (1000 * 60 * 60 * 24));
		if (days < 0) return `${Math.abs(days)}d overdue`;
		if (days === 0) return 'Today';
		if (days === 1) return 'Tomorrow';
		return `${days}d`;
	}

	function statusLabel(s: PmStatus): string {
		switch (s) {
			case PmStatus.TODO:
				return 'To Do';
			case PmStatus.IN_PROGRESS:
				return 'In Progress';
			case PmStatus.REVIEW:
				return 'Review';
			case PmStatus.DONE:
				return 'Done';
			case PmStatus.CANCELLED:
				return 'Cancelled';
			case PmStatus.ARCHIVED:
				return 'Archived';
			default:
				return s;
		}
	}

	function statusColor(s: PmStatus): string {
		switch (s) {
			case PmStatus.TODO:
				return 'bg-slate-600/30 text-slate-300';
			case PmStatus.IN_PROGRESS:
				return 'bg-blue-600/20 text-blue-400';
			case PmStatus.REVIEW:
				return 'bg-purple-600/20 text-purple-400';
			case PmStatus.DONE:
				return 'bg-green-600/20 text-green-400';
			case PmStatus.CANCELLED:
				return 'bg-red-600/20 text-red-400';
			case PmStatus.ARCHIVED:
				return 'bg-slate-600/20 text-slate-500';
			default:
				return 'bg-slate-600/20 text-slate-400';
		}
	}

	function priorityColor(p: PmPriority | undefined): string {
		switch (p) {
			case PmPriority.URGENT:
				return 'text-red-400';
			case PmPriority.HIGH:
				return 'text-orange-400';
			case PmPriority.NORMAL:
				return 'text-slate-300';
			case PmPriority.LOW:
				return 'text-slate-500';
			default:
				return 'text-slate-400';
		}
	}

	function priorityLabel(p: PmPriority | undefined): string {
		switch (p) {
			case PmPriority.URGENT:
				return 'Urgent';
			case PmPriority.HIGH:
				return 'High';
			case PmPriority.NORMAL:
				return 'Normal';
			case PmPriority.LOW:
				return 'Low';
			default:
				return '';
		}
	}

	function activityIcon(action: PmActivity['action']): string {
		switch (action) {
			case 'created':
				return 'M12 4v16m8-8H4';
			case 'updated':
				return 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
			case 'commented':
				return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
			case 'status_changed':
				return 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
			case 'reopened':
				return 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
			case 'closed':
				return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
			default:
				return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
		}
	}

	function statusEntries(
		byStatus: Record<string, number>
	): Array<{ status: PmStatus; count: number }> {
		return Object.entries(byStatus).map(([s, c]) => ({
			status: s as PmStatus,
			count: c
		}));
	}

	function getProjectTitle(projectId: number | undefined): string {
		if (projectId == null) return '';
		const proj = $pmProjects.find((p) => p.id === projectId);
		return proj ? proj.title : `#${projectId}`;
	}

	// --- Derived data ---

	$: stats = $pmStats;

	$: dueSoonTasks = $pmTasks
		.filter((t) => {
			if (!t.dueDate) return false;
			if (t.status === PmStatus.DONE || t.status === PmStatus.CANCELLED) return false;
			const due = new Date(t.dueDate);
			const now = new Date();
			const diff = due.getTime() - now.getTime();
			const days = diff / (1000 * 60 * 60 * 24);
			return days <= 7;
		})
		.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

	$: blockedTaskIds = new Set($pmBlocks.map((b) => b.blockedId));

	$: blockedTasks = $pmTasks.filter(
		(t) => blockedTaskIds.has(t.id) && t.status !== PmStatus.DONE && t.status !== PmStatus.CANCELLED
	);

	$: inProgressTasks = $pmTasks.filter((t) => t.status === PmStatus.IN_PROGRESS);

	$: recentActivities = [...$pmActivities].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);

	function isDueOverdue(dateStr: string): boolean {
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return d.getTime() < now.getTime();
	}

	// --- Lifecycle ---

	onMount(async () => {
		initPmListeners();
		try {
			await Promise.all([
				loadStats(),
				loadActivities(undefined, undefined, 20),
				loadProjects(),
				loadBlocks()
			]);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		destroyPmListeners();
	});
</script>

<div class="flex h-full flex-col">
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-slate-400">Loading dashboard...</p>
		</div>
	{:else}
		<!-- Header -->
		<div class="border-b border-slate-700 px-6 py-4">
			<h1 class="text-lg font-semibold text-slate-100">Project Management</h1>
			<p class="mt-1 text-sm text-slate-400">Overview of projects, tasks, and activity</p>
		</div>

		{#if errorMessage}
			<div class="border-b border-red-800 bg-red-900/30 px-6 py-2">
				<p class="text-sm text-red-400">{errorMessage}</p>
			</div>
		{/if}

		<div class="flex-1 overflow-y-auto p-6">
			<!-- Stats Header -->
			{#if stats}
				<div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
						<p class="text-xs font-medium uppercase tracking-wider text-slate-400">Projects</p>
						<p class="mt-1 text-2xl font-semibold text-slate-100">
							{stats.totalProjects}
						</p>
					</div>
					<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
						<p class="text-xs font-medium uppercase tracking-wider text-slate-400">Tasks</p>
						<p class="mt-1 text-2xl font-semibold text-slate-100">
							{stats.totalTasks}
						</p>
					</div>
					<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
						<p class="text-xs font-medium uppercase tracking-wider text-slate-400">Overdue</p>
						<p
							class="mt-1 text-2xl font-semibold {stats.overdueCount > 0
								? 'text-red-400'
								: 'text-slate-100'}"
						>
							{stats.overdueCount}
						</p>
					</div>
					<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
						<p class="text-xs font-medium uppercase tracking-wider text-slate-400">Blocked</p>
						<p
							class="mt-1 text-2xl font-semibold {stats.blockedCount > 0
								? 'text-amber-400'
								: 'text-slate-100'}"
						>
							{stats.blockedCount}
						</p>
					</div>
				</div>

				<!-- Status breakdown -->
				<div class="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
					<p class="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
						Tasks by Status
					</p>
					<div class="flex flex-wrap gap-3">
						{#each statusEntries(stats.tasksByStatus) as entry (entry.status)}
							<div class="flex items-center space-x-2">
								<span
									class="inline-block rounded px-2 py-0.5 text-xs font-medium {statusColor(
										entry.status
									)}"
								>
									{statusLabel(entry.status)}
								</span>
								<span class="text-sm font-medium text-slate-200">{entry.count}</span>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
					{#each Array(4) as _}
						<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
							<div class="h-3 w-16 animate-pulse rounded bg-slate-700"></div>
							<div class="mt-3 h-7 w-12 animate-pulse rounded bg-slate-700"></div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Due Soon -->
				<div class="rounded-lg border border-slate-700 bg-slate-800/50">
					<div class="border-b border-slate-700 px-4 py-3">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Due Soon</h2>
					</div>
					{#if dueSoonTasks.length === 0}
						<div class="flex items-center justify-center p-6">
							<p class="text-sm text-slate-400">No tasks due in the next 7 days</p>
						</div>
					{:else}
						<div class="divide-y divide-slate-700/50">
							{#each dueSoonTasks.slice(0, 8) as task (task.id)}
								<div class="flex items-center justify-between px-4 py-2.5">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-slate-200">{task.title}</p>
										<p class="mt-0.5 text-xs text-slate-500">
											{getProjectTitle(task.parentProjectId)}
										</p>
									</div>
									<div class="ml-3 flex items-center space-x-2">
										<span
											class="inline-block rounded px-2 py-0.5 text-xs font-medium {statusColor(
												task.status
											)}"
										>
											{statusLabel(task.status)}
										</span>
										{#if task.dueDate}
											<span
												class="whitespace-nowrap text-xs font-medium {isDueOverdue(task.dueDate)
													? 'text-red-400'
													: 'text-amber-400'}"
											>
												{formatDueDate(task.dueDate)}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Blocked Tasks -->
				<div class="rounded-lg border border-slate-700 bg-slate-800/50">
					<div class="border-b border-slate-700 px-4 py-3">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Blocked</h2>
					</div>
					{#if blockedTasks.length === 0}
						<div class="flex items-center justify-center p-6">
							<p class="text-sm text-slate-400">No blocked tasks</p>
						</div>
					{:else}
						<div class="divide-y divide-slate-700/50">
							{#each blockedTasks.slice(0, 8) as task (task.id)}
								<div class="flex items-center justify-between px-4 py-2.5">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-slate-200">{task.title}</p>
										<p class="mt-0.5 text-xs text-slate-500">
											{getProjectTitle(task.parentProjectId)}
										</p>
									</div>
									<div class="ml-3 flex items-center space-x-2">
										<span
											class="inline-block rounded px-2 py-0.5 text-xs font-medium {statusColor(
												task.status
											)}"
										>
											{statusLabel(task.status)}
										</span>
										{#if task.priority}
											<span class="text-xs {priorityColor(task.priority)}">
												{priorityLabel(task.priority)}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- In Progress -->
				<div class="rounded-lg border border-slate-700 bg-slate-800/50">
					<div class="border-b border-slate-700 px-4 py-3">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
							In Progress
						</h2>
					</div>
					{#if inProgressTasks.length === 0}
						<div class="flex items-center justify-center p-6">
							<p class="text-sm text-slate-400">No tasks in progress</p>
						</div>
					{:else}
						<div class="divide-y divide-slate-700/50">
							{#each inProgressTasks.slice(0, 8) as task (task.id)}
								<div class="flex items-center justify-between px-4 py-2.5">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-slate-200">{task.title}</p>
										<p class="mt-0.5 text-xs text-slate-500">
											{getProjectTitle(task.parentProjectId)}
										</p>
									</div>
									<div class="ml-3 flex items-center space-x-2">
										{#if task.priority}
											<span class="text-xs {priorityColor(task.priority)}">
												{priorityLabel(task.priority)}
											</span>
										{/if}
										{#if task.dueDate}
											<span
												class="whitespace-nowrap text-xs {isDueOverdue(task.dueDate)
													? 'text-red-400'
													: 'text-slate-400'}"
											>
												{formatDueDate(task.dueDate)}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Recent Activity -->
				<div class="rounded-lg border border-slate-700 bg-slate-800/50">
					<div class="border-b border-slate-700 px-4 py-3">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
							Recent Activity
						</h2>
					</div>
					{#if recentActivities.length === 0}
						<div class="flex items-center justify-center p-6">
							<p class="text-sm text-slate-400">No recent activity</p>
						</div>
					{:else}
						<div class="divide-y divide-slate-700/50">
							{#each recentActivities as activity (activity.id)}
								<div class="flex items-start space-x-3 px-4 py-2.5">
									<div class="mt-0.5 flex-shrink-0">
										<svg
											class="h-4 w-4 text-slate-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d={activityIcon(activity.action)}
											/>
										</svg>
									</div>
									<div class="min-w-0 flex-1">
										<p class="text-sm text-slate-200">
											<span class="font-medium text-slate-100">{activity.actor}</span>
											{activity.action.replace('_', ' ')}
											{activity.targetType}
											{#if activity.targetTitle}
												<span class="text-slate-300">"{activity.targetTitle}"</span>
											{/if}
										</p>
										{#if activity.details}
											<p class="mt-0.5 text-xs text-slate-500">
												{activity.details}
											</p>
										{/if}
										<p class="mt-0.5 text-xs text-slate-500">
											{formatDate(activity.createdAt)}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
