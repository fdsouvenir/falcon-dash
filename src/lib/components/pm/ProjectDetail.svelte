<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		getProject,
		loadTasks,
		tasks,
		type Project,
		type Task
	} from '$lib/stores/pm-projects.js';
	import {
		listComments,
		listActivities,
		type Comment,
		type Activity
	} from '$lib/stores/pm-operations.js';
	import { getDomain, getFocus, type Domain, type Focus } from '$lib/stores/pm-domains.js';
	import { pmGet } from '$lib/stores/pm-api.js';
	import {
		STATUS_BADGE,
		formatStatusLabel,
		formatRelativeTime,
		getStatusPill,
		getPriorityTag,
		formatDueDate
	} from './pm-utils.js';

	interface Props {
		projectId: number;
		onClose?: () => void;
		onTaskClick?: (taskId: number) => void;
	}

	let { projectId, onClose, onTaskClick }: Props = $props();

	let project = $state<Project | null>(null);
	let domain = $state<Domain | null>(null);
	let focus = $state<Focus | null>(null);
	let taskList = $state<Task[]>([]);
	let comments = $state<Comment[]>([]);
	let activities = $state<Activity[]>([]);
	let activeTab = $state<'tasks' | 'comments' | 'activity'>('tasks');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let descExpanded = $state(false);
	let descFullscreen = $state(false);
	let expandedTasks = new SvelteSet<number>();

	async function loadData() {
		loading = true;
		error = null;
		try {
			project = await getProject(projectId);
			if (project) {
				if (project.focus_id) {
					try {
						focus = await getFocus(project.focus_id);
						if (focus?.domain_id) {
							domain = await getDomain(focus.domain_id);
						}
					} catch {
						// domain/focus lookup is non-critical
					}
				}
				await loadTasks({ parent_project_id: projectId });
				comments = await listComments('project', projectId);
				activities = await listActivities(projectId, 20);
			}
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const unsub = tasks.subscribe(async (v) => {
			const rootTasks = v.filter((t) => t.parent_task_id === null);
			const allTasks = [...v];
			const subtaskPromises = rootTasks.map((t) =>
				pmGet<{ items: Task[] }>('/api/pm/tasks', {
					parent_task_id: t.id,
					limit: '500'
				}).catch(() => ({ items: [] as Task[] }))
			);
			const subtaskResults = await Promise.all(subtaskPromises);
			const existingIds: Record<number, true> = {};
			for (const t of allTasks) existingIds[t.id] = true;
			for (const res of subtaskResults) {
				for (const st of res.items) {
					if (!existingIds[st.id]) {
						allTasks.push(st);
						existingIds[st.id] = true;
					}
				}
			}
			taskList = allTasks;
		});
		return unsub;
	});

	$effect(() => {
		loadData();
	});

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	function buildTaskTree(allTasks: Task[]): Task[] {
		return allTasks
			.filter((t) => t.parent_task_id === null)
			.sort((a, b) => a.sort_order - b.sort_order);
	}

	function getSubtasks(parentId: number, allTasks: Task[]): Task[] {
		return allTasks
			.filter((t) => t.parent_task_id === parentId)
			.sort((a, b) => a.sort_order - b.sort_order);
	}

	function toggleTaskExpand(taskId: number) {
		if (expandedTasks.has(taskId)) expandedTasks.delete(taskId);
		else expandedTasks.add(taskId);
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose?.();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}

	function handleActivityClick(activity: Activity) {
		if (activity.target_type === 'task' && activity.target_id) {
			onTaskClick?.(activity.target_id);
		} else if (activity.target_type === 'comment') {
			activeTab = 'comments';
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
	onkeydown={handleBackdropKeydown}
>
	<div
		class="flex h-full w-full flex-col overflow-hidden bg-gray-900 shadow-xl md:h-auto md:max-h-[90vh] md:w-auto md:max-w-4xl md:rounded-lg"
	>
		{#if loading}
			<div class="p-8 text-center text-base text-gray-400">Loading...</div>
		{:else if error}
			<div class="p-8">
				<div class="mb-4 text-base text-red-500">Error: {error}</div>
				<button
					onclick={onClose}
					class="min-h-[44px] rounded bg-gray-700 px-4 py-3 text-base text-white hover:bg-gray-600"
				>
					Close
				</button>
			</div>
		{:else if project}
			<!-- Header -->
			<div class="border-b border-gray-700 bg-gray-800 px-3 py-2">
				<!-- Row 1: breadcrumb bar -->
				<div class="flex min-h-[36px] items-center gap-2">
					<button
						onclick={onClose}
						class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
						title="Back"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							></path>
						</svg>
					</button>

					{#if domain && focus}
						<span class="shrink-0 text-xs text-gray-500">
							{domain.name} / {focus.name}
						</span>
					{/if}

					<span class="flex-1"></span>

					<span
						class="shrink-0 rounded px-1.5 py-0.5 text-xs {STATUS_BADGE[project.status] ||
							'bg-gray-600 text-gray-200'}"
					>
						{formatStatusLabel(project.status)}
					</span>

					{#if getPriorityTag(project.priority)}
						{@const pt = getPriorityTag(project.priority)!}
						<span class="shrink-0 rounded px-1.5 py-0.5 text-xs {pt.classes}">
							{pt.label}
						</span>
					{/if}

					{#if project.due_date}
						<span class="shrink-0 text-xs text-gray-400">{project.due_date}</span>
					{/if}
				</div>

				<!-- Row 2: title -->
				<h1 class="px-1 pt-1 pb-0.5 text-base font-semibold text-white">
					{project.title}
				</h1>
			</div>

			<!-- Description -->
			{#if project.description}
				<div class="border-b border-gray-700/50 px-4 py-2">
					<div class="flex items-center justify-between">
						<span class="text-[10px] uppercase tracking-wider text-gray-500"> Description </span>
						{#if descExpanded}
							<button
								class="rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
								title="View full screen"
								onclick={() => {
									descFullscreen = true;
								}}
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
									></path>
								</svg>
							</button>
						{/if}
					</div>
					<button
						class="mt-1 w-full text-left text-xs text-gray-400 hover:text-gray-300"
						onclick={() => {
							descExpanded = !descExpanded;
						}}
					>
						{#if descExpanded}
							<span class="whitespace-pre-wrap">{project.description}</span>
						{:else}
							<span class="line-clamp-2">{project.description}</span>
						{/if}
					</button>
				</div>
			{/if}

			<!-- Description fullscreen overlay -->
			{#if descFullscreen && project.description}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="fixed inset-0 z-[60] flex flex-col bg-gray-900/95"
					onkeydown={(e) => {
						if (e.key === 'Escape') descFullscreen = false;
					}}
				>
					<div class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
						<button
							onclick={() => {
								descFullscreen = false;
							}}
							class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
							title="Close"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								></path>
							</svg>
						</button>
						<h2 class="text-sm font-semibold text-white">{project.title}</h2>
					</div>
					<div class="flex-1 overflow-y-auto p-6">
						<div class="text-[10px] uppercase tracking-wider text-gray-500">Description</div>
						<p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
							{project.description}
						</p>
					</div>
				</div>
			{/if}

			<!-- Tabs -->
			<div class="border-b border-gray-700 bg-gray-800">
				<div class="flex gap-1 px-4">
					<button
						onclick={() => {
							activeTab = 'tasks';
						}}
						class="min-h-[40px] px-3 py-2 text-xs font-medium {activeTab === 'tasks'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Tasks ({taskList.length})
					</button>
					<button
						onclick={() => {
							activeTab = 'comments';
						}}
						class="min-h-[40px] px-3 py-2 text-xs font-medium {activeTab === 'comments'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Comments ({comments.length})
					</button>
					<button
						onclick={() => {
							activeTab = 'activity';
						}}
						class="min-h-[40px] px-3 py-2 text-xs font-medium {activeTab === 'activity'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Activity
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="flex-1 overflow-y-auto">
				{#if activeTab === 'tasks'}
					<!-- Table header -->
					<div
						class="sticky top-0 z-[1] flex items-center gap-3 border-b border-gray-700 bg-gray-900 px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<span class="w-5"></span>
						<span class="flex-1">Task</span>
						<span class="w-[72px] text-center">Status</span>
						<span class="hidden w-[52px] text-center sm:block">Priority</span>
						<span class="w-[72px] text-right">Due</span>
					</div>

					<!-- Task rows -->
					<div class="divide-y divide-gray-800">
						{#each buildTaskTree(taskList) as task (task.id)}
							{@const subs = getSubtasks(task.id, taskList)}
							{@const hasSubs = subs.length > 0}
							{@const isExpanded = expandedTasks.has(task.id)}
							{@const sp = getStatusPill(task.status)}
							{@const pt = getPriorityTag(task.priority)}
							{@const dd = formatDueDate(task.due_date)}
							<div>
								<div
									class="flex min-h-[40px] items-center gap-3 px-4 py-1.5 transition-colors hover:bg-gray-800/60"
								>
									<!-- Expand/collapse toggle -->
									{#if hasSubs}
										<button
											class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-300"
											onclick={() => toggleTaskExpand(task.id)}
											title={isExpanded ? 'Collapse' : 'Expand'}
										>
											<svg
												class="h-3 w-3 transition-transform {isExpanded ? 'rotate-90' : ''}"
												fill="currentColor"
												viewBox="0 0 12 12"
											>
												<path d="M4 2l4 4-4 4z" />
											</svg>
										</button>
									{:else}
										<span class="w-5"></span>
									{/if}

									<!-- Title (clickable) -->
									<button
										class="min-w-0 flex-1 truncate text-left text-sm text-white hover:text-blue-400"
										onclick={() => onTaskClick?.(task.id)}
									>
										{task.title}
										{#if hasSubs && !isExpanded}
											<span class="ml-1 text-xs text-gray-600">({subs.length})</span>
										{/if}
									</button>

									<!-- Status pill -->
									<span
										class="w-[72px] shrink-0 rounded-full px-2 py-0.5 text-center text-xs {sp.classes}"
									>
										{sp.label}
									</span>

									<!-- Priority tag (hidden on mobile) -->
									<span class="hidden w-[52px] shrink-0 text-center sm:block">
										{#if pt}
											<span class="rounded px-1.5 py-0.5 text-xs {pt.classes}">
												{pt.label}
											</span>
										{/if}
									</span>

									<!-- Due date -->
									<span
										class="w-[72px] shrink-0 text-right text-xs {dd ? dd.color : 'text-gray-600'}"
									>
										{dd ? dd.text : '\u2014'}
									</span>
								</div>

								<!-- Subtasks (when expanded) -->
								{#if hasSubs && isExpanded}
									{#each subs as subtask (subtask.id)}
										{@const ssp = getStatusPill(subtask.status)}
										{@const spt = getPriorityTag(subtask.priority)}
										{@const sdd = formatDueDate(subtask.due_date)}
										<div
											class="flex min-h-[36px] items-center gap-3 py-1 pl-12 pr-4 transition-colors hover:bg-gray-800/40"
										>
											<span class="w-5"></span>
											<button
												class="min-w-0 flex-1 truncate text-left text-sm text-gray-300 hover:text-blue-400"
												onclick={() => onTaskClick?.(subtask.id)}
											>
												{subtask.title}
											</button>
											<span
												class="w-[72px] shrink-0 rounded-full px-2 py-0.5 text-center text-xs {ssp.classes}"
											>
												{ssp.label}
											</span>
											<span class="hidden w-[52px] shrink-0 text-center sm:block">
												{#if spt}
													<span class="rounded px-1.5 py-0.5 text-xs {spt.classes}">
														{spt.label}
													</span>
												{/if}
											</span>
											<span
												class="w-[72px] shrink-0 text-right text-xs {sdd
													? sdd.color
													: 'text-gray-600'}"
											>
												{sdd ? sdd.text : '\u2014'}
											</span>
										</div>
									{/each}
								{/if}
							</div>
						{/each}
					</div>

					{#if taskList.length === 0}
						<p class="p-4 text-sm text-gray-500">No tasks</p>
					{/if}
				{:else if activeTab === 'comments'}
					<div class="space-y-3 p-4">
						{#each comments as comment (comment.id)}
							<div class="rounded bg-gray-800 p-3">
								<div class="mb-1 flex items-center gap-2">
									<span class="text-sm font-medium text-white">{comment.author}</span>
									<span class="text-xs text-gray-400">{formatTimestamp(comment.created_at)}</span>
								</div>
								<p class="text-sm text-gray-300">{comment.body}</p>
							</div>
						{/each}
						{#if comments.length === 0}
							<p class="text-sm text-gray-500">No comments</p>
						{/if}
					</div>
				{:else if activeTab === 'activity'}
					<div class="divide-y divide-gray-800">
						{#each activities as activity (activity.id)}
							<div class="px-4 py-2.5">
								<div class="text-xs">
									<span class="font-medium text-white">{activity.actor}</span>
									<span class="text-gray-400">
										{activity.action}
									</span>
									{#if activity.target_type === 'task' && activity.target_id}
										<button
											class="text-blue-400 hover:underline"
											onclick={() => handleActivityClick(activity)}
										>
											{activity.target_title || `Task #${activity.target_id}`}
										</button>
									{:else if activity.target_type === 'comment'}
										<button
											class="text-blue-400 hover:underline"
											onclick={() => handleActivityClick(activity)}
										>
											{activity.target_title || 'comment'}
										</button>
									{:else}
										<span class="text-white">
											{activity.target_title || ''}
										</span>
									{/if}
								</div>
								{#if activity.details}
									<div class="mt-0.5 text-xs text-gray-500">
										{activity.details}
									</div>
								{/if}
								<div class="mt-0.5 text-xs text-gray-600">
									{formatRelativeTime(activity.created_at)}
								</div>
							</div>
						{/each}
						{#if activities.length === 0}
							<p class="p-4 text-sm text-gray-500">No recent activity</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
