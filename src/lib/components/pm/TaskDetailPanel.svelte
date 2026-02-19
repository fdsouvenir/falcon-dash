<script lang="ts">
	import { getTask, getProject, type Task } from '$lib/stores/pm-projects.js';
	import { listComments, type Comment } from '$lib/stores/pm-operations.js';
	import { pmGet } from '$lib/stores/pm-api.js';
	import {
		STATUS_BORDER,
		STATUS_BADGE,
		getPriorityIndicator,
		formatStatusLabel
	} from './pm-utils.js';

	interface Props {
		taskId: number;
		onClose: () => void;
		onNavigate?: (taskId: number) => void;
	}

	let { taskId, onClose, onNavigate }: Props = $props();

	let task = $state<Task | null>(null);
	let ancestry = $state<Array<{ id: number; title: string; type: 'project' | 'task' }>>([]);
	let subtasks = $state<Task[]>([]);
	let comments = $state<Comment[]>([]);
	let loading = $state(true);

	// Re-load data whenever taskId changes
	$effect(() => {
		const id = taskId;
		loadData(id);
	});

	// Keyboard listener with cleanup
	$effect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	});

	async function loadData(id: number) {
		loading = true;
		task = await getTask(id);
		await buildAncestry();
		await loadSubtasks();
		comments = await listComments('task', id);
		loading = false;
	}

	async function buildAncestry() {
		if (!task) return;
		const chain: Array<{ id: number; title: string; type: 'project' | 'task' }> = [];

		let currentTaskId = task.parent_task_id;
		while (currentTaskId) {
			const parentTask = await getTask(currentTaskId);
			chain.unshift({ id: parentTask.id, title: parentTask.title, type: 'task' });
			currentTaskId = parentTask.parent_task_id;
		}

		if (task.parent_project_id) {
			const project = await getProject(task.parent_project_id);
			chain.unshift({ id: project.id, title: project.title, type: 'project' });
		}

		ancestry = chain;
	}

	async function loadSubtasks() {
		if (!task) return;
		const res = await pmGet<{ items: Task[] }>('/api/pm/tasks', {
			parent_task_id: task.id,
			limit: '500'
		});
		subtasks = res.items.sort((a, b) => a.sort_order - b.sort_order);
	}

	function handleBreadcrumbClick(item: { id: number; type: 'project' | 'task' }) {
		if (item.type === 'task' && onNavigate) {
			onNavigate(item.id);
		}
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	function handleBackdropClick() {
		onClose();
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40 bg-black/50" onclick={handleBackdropClick}></div>

<!-- Panel -->
<div
	class="fixed inset-0 z-50 overflow-y-auto bg-gray-900 shadow-xl md:inset-y-0 md:left-auto md:right-0 md:w-[500px]"
>
	{#if loading}
		<div class="flex h-full items-center justify-center text-base text-gray-400">Loading...</div>
	{:else if task}
		<!-- Header -->
		<div
			class="sticky top-0 z-10 flex min-h-[44px] items-center justify-between border-b border-gray-700 bg-gray-900 p-4"
		>
			<h2 class="text-lg font-semibold text-white">Task Details</h2>
			<button
				onclick={onClose}
				class="min-h-[44px] min-w-[44px] rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
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

		<div class="space-y-6 p-4">
			<!-- Ancestry breadcrumb -->
			{#if ancestry.length > 0}
				<div class="flex flex-wrap items-center gap-2 text-sm text-gray-400">
					{#each ancestry as item, i (item.id)}
						{#if i > 0}
							<span>/</span>
						{/if}
						<button
							onclick={() => handleBreadcrumbClick(item)}
							class="min-h-[44px] py-3 hover:text-white hover:underline"
						>
							{item.title}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Title -->
			<h2 class="text-xl font-semibold text-white">{task.title}</h2>

			<!-- Body -->
			{#if task.body}
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-300">Description</label>
					<div class="rounded border border-gray-700 bg-gray-800 p-3 text-base text-gray-300">
						{task.body}
					</div>
				</div>
			{/if}

			<!-- Status & Priority -->
			<div class="flex flex-wrap gap-3">
				<div>
					<label class="mb-1 block text-sm text-gray-400">Status</label>
					<span
						class="inline-block rounded px-3 py-1 text-sm {STATUS_BADGE[task.status] ||
							'bg-gray-600 text-gray-200'}"
					>
						{formatStatusLabel(task.status)}
					</span>
				</div>
				{#if getPriorityIndicator(task.priority)}
					{@const taskPriority = getPriorityIndicator(task.priority)!}
					<div>
						<label class="mb-1 block text-sm text-gray-400">Priority</label>
						<span class="inline-flex items-center gap-1.5 text-sm text-gray-300">
							<span
								class="inline-block h-2 w-2 rounded-full {taskPriority.dot} {taskPriority.pulse
									? 'animate-pulse'
									: ''}"
							></span>
							{taskPriority.label}
						</span>
					</div>
				{/if}
				{#if task.due_date}
					<div>
						<label class="mb-1 block text-sm text-gray-400">Due Date</label>
						<span class="text-base text-gray-300">{task.due_date}</span>
					</div>
				{/if}
			</div>

			<!-- Subtasks -->
			{#if subtasks.length > 0}
				<div>
					<h3 class="mb-2 text-lg font-semibold text-white">Subtasks</h3>
					<div class="space-y-1">
						{#each subtasks as subtask (subtask.id)}
							{@const subPriority = getPriorityIndicator(subtask.priority)}
							<button
								onclick={() => onNavigate?.(subtask.id)}
								class="flex min-h-[40px] w-full items-center gap-2 rounded border-l-2 py-2 pl-3 pr-2 text-left transition-colors hover:bg-gray-800 {STATUS_BORDER[
									subtask.status
								] || 'border-l-gray-500'}"
							>
								<span class="flex-1 text-sm text-white">{subtask.title}</span>
								{#if subPriority}
									<span
										class="inline-block h-1.5 w-1.5 shrink-0 rounded-full {subPriority.dot} {subPriority.pulse
											? 'animate-pulse'
											: ''}"
										title={subPriority.label}
									></span>
								{/if}
								<span class="shrink-0 text-xs text-gray-500">
									{formatStatusLabel(subtask.status)}
								</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Comments -->
			{#if comments.length > 0}
				<div>
					<h3 class="mb-2 text-lg font-semibold text-white">Comments</h3>
					<div class="space-y-3">
						{#each comments as comment (comment.id)}
							<div class="rounded border border-gray-700 bg-gray-800 p-3">
								<div class="mb-1 flex items-start justify-between">
									<span class="text-sm font-medium text-gray-300">{comment.author}</span>
									<span class="text-xs text-gray-500">{formatTimestamp(comment.created_at)}</span>
								</div>
								<p class="text-base text-white">{comment.body}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
