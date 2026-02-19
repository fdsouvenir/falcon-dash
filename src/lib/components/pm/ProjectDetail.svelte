<script lang="ts">
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
		STATUS_BORDER,
		STATUS_BADGE,
		getPriorityIndicator,
		formatStatusLabel
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
			// Merge subtasks: for each root task, fetch its children
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

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose?.();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
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
			<div class="border-b border-gray-700 bg-gray-800 p-6">
				<!-- Breadcrumb -->
				{#if domain && focus}
					<div class="mb-3 text-sm text-gray-400">
						<span>{domain.name}</span>
						<span class="mx-2">›</span>
						<span>{focus.name}</span>
					</div>
				{/if}

				<div class="flex items-start justify-between gap-4">
					<h1 class="text-xl font-bold text-white md:text-2xl">{project.title}</h1>
					<button
						onclick={onClose}
						class="min-h-[44px] min-w-[44px] rounded p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
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
				</div>

				<!-- Metadata -->
				<div class="mt-4 flex flex-wrap items-center gap-3">
					<span
						class="rounded px-2 py-1 text-sm {STATUS_BADGE[project.status] ||
							'bg-gray-600 text-gray-200'}"
					>
						{formatStatusLabel(project.status)}
					</span>
					{#if getPriorityIndicator(project.priority)}
						{@const projPriority = getPriorityIndicator(project.priority)!}
						<span class="flex items-center gap-1.5 text-sm text-gray-300">
							<span
								class="inline-block h-2 w-2 rounded-full {projPriority.dot} {projPriority.pulse
									? 'animate-pulse'
									: ''}"
							></span>
							{projPriority.label}
						</span>
					{/if}
					{#if project.due_date}
						<span class="text-sm text-gray-400">Due: {project.due_date}</span>
					{/if}
				</div>

				{#if project.description}
					<p class="mt-4 text-base text-gray-300">{project.description}</p>
				{/if}
			</div>

			<!-- Tabs -->
			<div class="border-b border-gray-700 bg-gray-800">
				<div class="flex gap-1 px-6">
					<button
						onclick={() => {
							activeTab = 'tasks';
						}}
						class="min-h-[44px] px-4 py-3 text-sm font-medium {activeTab === 'tasks'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Tasks ({taskList.length})
					</button>
					<button
						onclick={() => {
							activeTab = 'comments';
						}}
						class="min-h-[44px] px-4 py-3 text-sm font-medium {activeTab === 'comments'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Comments ({comments.length})
					</button>
					<button
						onclick={() => {
							activeTab = 'activity';
						}}
						class="min-h-[44px] px-4 py-3 text-sm font-medium {activeTab === 'activity'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Activity
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if activeTab === 'tasks'}
					<div class="space-y-1">
						{#each buildTaskTree(taskList) as task (task.id)}
							{@const taskPriority = getPriorityIndicator(task.priority)}
							<button
								onclick={() => onTaskClick?.(task.id)}
								class="flex min-h-[40px] w-full items-center gap-3 rounded border-l-2 py-2 pl-3 pr-2 text-left transition-colors hover:bg-gray-800 {STATUS_BORDER[
									task.status
								] || 'border-l-gray-500'}"
							>
								<span class="flex-1 text-sm text-white hover:text-blue-400">
									{task.title}
								</span>
								{#if taskPriority}
									<span
										class="inline-block h-2 w-2 shrink-0 rounded-full {taskPriority.dot} {taskPriority.pulse
											? 'animate-pulse'
											: ''}"
										title={taskPriority.label}
									></span>
								{/if}
								<span class="shrink-0 text-xs text-gray-500">
									{formatStatusLabel(task.status)}
								</span>
							</button>
							{#each getSubtasks(task.id, taskList) as subtask (subtask.id)}
								{@const subPriority = getPriorityIndicator(subtask.priority)}
								<button
									onclick={() => onTaskClick?.(subtask.id)}
									class="ml-5 flex min-h-[36px] w-[calc(100%-1.25rem)] items-center gap-3 rounded border-l-2 py-1.5 pl-3 pr-2 text-left transition-colors hover:bg-gray-800 {STATUS_BORDER[
										subtask.status
									] || 'border-l-gray-500'}"
								>
									<span class="flex-1 text-sm text-gray-300 hover:text-blue-400">
										{subtask.title}
									</span>
									{#if subPriority}
										<span
											class="inline-block h-1.5 w-1.5 shrink-0 rounded-full {subPriority.dot} {subPriority.pulse
												? 'animate-pulse'
												: ''}"
											title={subPriority.label}
										></span>
									{/if}
									<span class="shrink-0 text-xs text-gray-600">
										{formatStatusLabel(subtask.status)}
									</span>
								</button>
							{/each}
						{/each}
						{#if taskList.length === 0}
							<p class="text-base text-gray-500">No tasks</p>
						{/if}
					</div>
				{:else if activeTab === 'comments'}
					<div class="space-y-4">
						{#each comments as comment (comment.id)}
							<div class="rounded bg-gray-800 p-4">
								<div class="mb-2 flex items-center gap-2">
									<span class="text-sm font-medium text-white">{comment.author}</span>
									<span class="text-sm text-gray-400">{formatTimestamp(comment.created_at)}</span>
								</div>
								<p class="text-base text-gray-300">{comment.body}</p>
							</div>
						{/each}
						{#if comments.length === 0}
							<p class="text-base text-gray-500">No comments</p>
						{/if}
					</div>
				{:else if activeTab === 'activity'}
					<div class="space-y-2">
						{#each activities as activity (activity.id)}
							<div class="rounded bg-gray-800 p-3">
								<div class="text-sm">
									<span class="font-medium text-white">{activity.actor}</span>
									<span class="text-gray-400"> {activity.action} </span>
									<span class="text-white">{activity.target_type}</span>
									{#if activity.target_title}
										<span class="text-gray-400"> "{activity.target_title}"</span>
									{/if}
								</div>
								<div class="mt-1 text-xs text-gray-500">
									{formatTimestamp(activity.created_at)}
								</div>
								{#if activity.details}
									<div class="mt-1 text-xs text-gray-400">
										{activity.details}
									</div>
								{/if}
							</div>
						{/each}
						{#if activities.length === 0}
							<p class="text-base text-gray-500">No recent activity</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
