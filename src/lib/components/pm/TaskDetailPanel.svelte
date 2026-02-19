<script lang="ts">
	import { getTask, getProject, type Task } from '$lib/stores/pm-projects.js';
	import { listComments, type Comment } from '$lib/stores/pm-operations.js';
	import { pmGet } from '$lib/stores/pm-api.js';
	import { STATUS_BORDER, STATUS_BADGE, getPriorityBadge, formatStatusLabel } from './pm-utils.js';

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
		<!-- Header with back arrow -->
		<div
			class="sticky top-0 z-10 flex min-h-[44px] items-center gap-2 border-b border-gray-700 bg-gray-900 px-3 py-2"
		>
			<button
				onclick={onClose}
				class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
				title="Back"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
					></path>
				</svg>
			</button>
			<h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-white">{task.title}</h2>
		</div>

		<div class="space-y-5 p-4">
			<!-- Ancestry breadcrumb -->
			{#if ancestry.length > 0}
				<div class="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
					{#each ancestry as item, i (item.id)}
						{#if i > 0}
							<span class="text-gray-600">/</span>
						{/if}
						<button
							onclick={() => handleBreadcrumbClick(item)}
							class="rounded px-1 py-0.5 hover:bg-gray-800 hover:text-white"
						>
							{item.title}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Body -->
			{#if task.body}
				<div>
					<label class="mb-1 block text-xs font-medium text-gray-400">Description</label>
					<div class="rounded border border-gray-700 bg-gray-800 p-3 text-sm text-gray-300">
						{task.body}
					</div>
				</div>
			{/if}

			<!-- Status & Priority -->
			<div class="flex flex-wrap items-center gap-3">
				<span
					class="rounded px-2 py-0.5 text-xs {STATUS_BADGE[task.status] ||
						'bg-gray-600 text-gray-200'}"
				>
					{formatStatusLabel(task.status)}
				</span>
				{#if getPriorityBadge(task.priority).label !== '\u2014'}
					{@const pb = getPriorityBadge(task.priority)}
					<span class="rounded px-1.5 py-0.5 text-xs {pb.classes}">
						{pb.label}
					</span>
				{/if}
				{#if task.due_date}
					<span class="text-xs text-gray-400">Due: {task.due_date}</span>
				{/if}
			</div>

			<!-- Subtasks -->
			{#if subtasks.length > 0}
				<div>
					<h3 class="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
						Subtasks ({subtasks.length})
					</h3>
					<div class="divide-y divide-gray-800">
						{#each subtasks as subtask (subtask.id)}
							{@const spb = getPriorityBadge(subtask.priority)}
							<button
								onclick={() => onNavigate?.(subtask.id)}
								class="flex min-h-[36px] w-full items-center gap-2 border-l-2 py-1.5 pl-3 pr-2 text-left transition-colors hover:bg-gray-800 {STATUS_BORDER[
									subtask.status
								] || 'border-l-gray-500'}"
							>
								<span class="min-w-0 flex-1 truncate text-sm text-white">
									{subtask.title}
								</span>
								{#if spb.label !== '\u2014'}
									<span class="shrink-0 rounded px-1.5 py-0.5 text-xs {spb.classes}">
										{spb.label}
									</span>
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
					<h3 class="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
						Comments ({comments.length})
					</h3>
					<div class="space-y-2">
						{#each comments as comment (comment.id)}
							<div class="rounded border border-gray-700 bg-gray-800 p-3">
								<div class="mb-1 flex items-start justify-between">
									<span class="text-xs font-medium text-gray-300">
										{comment.author}
									</span>
									<span class="text-xs text-gray-500">
										{formatTimestamp(comment.created_at)}
									</span>
								</div>
								<p class="text-sm text-white">{comment.body}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
