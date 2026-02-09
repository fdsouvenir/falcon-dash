<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { PmStatus, PmPriority } from '$lib/types';
	import type { PmComment, PmActivity } from '$lib/types';
	import {
		pmTasks,
		pmComments,
		pmAttachments,
		pmBlocks,
		pmActivities,
		pmMilestones,
		pmProjects,
		loadComments,
		loadAttachments,
		loadBlocks,
		loadActivities,
		updateTask,
		deleteTask,
		createTask,
		moveTask,
		createComment,
		updateComment,
		deleteComment,
		createAttachment,
		deleteAttachment,
		createBlock,
		deleteBlock
	} from '$lib/stores';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';

	interface Props {
		taskId: number;
		open: boolean;
	}

	let { taskId, open }: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		navigate: { taskId: number };
	}>();

	// --- State ---

	let loading = $state(true);
	let errorMessage = $state('');

	// Editing state
	let editingTitle = $state(false);
	let editTitleValue = $state('');
	let editingDescription = $state(false);
	let editDescriptionValue = $state('');
	let editingStatus = $state(false);
	let editingPriority = $state(false);
	let editingMilestone = $state(false);
	let editingDueDate = $state(false);
	let editDueDateValue = $state('');

	// Subtask state
	let addingSubtask = $state(false);
	let newSubtaskTitle = $state('');

	// Comment state
	let newCommentBody = $state('');
	let editingCommentId = $state<number | null>(null);
	let editCommentBody = $state('');

	// Attachment state
	let addingAttachment = $state(false);
	let newAttachmentName = $state('');
	let newAttachmentPath = $state('');

	// Blocking state
	let addingBlocker = $state(false);
	let addingBlocked = $state(false);
	let blockerTaskIdInput = $state('');
	let blockedTaskIdInput = $state('');

	// Move state
	let movingProject = $state(false);

	// Delete state
	let confirmingDelete = $state(false);

	// --- Helpers ---

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
				return 'None';
		}
	}

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

	function formatDueDate(dateStr: string | undefined): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString();
	}

	function isDueOverdue(dateStr: string | undefined): boolean {
		if (!dateStr) return false;
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return d.getTime() < now.getTime();
	}

	function getMilestoneName(milestoneId: number | undefined): string {
		if (milestoneId == null) return 'None';
		const ms = $pmMilestones.find((m) => m.id === milestoneId);
		return ms ? ms.name : `#${milestoneId}`;
	}

	function getProjectTitle(projectId: number | undefined): string {
		if (projectId == null) return 'None';
		const proj = $pmProjects.find((p) => p.id === projectId);
		return proj ? proj.title : `#${projectId}`;
	}

	function getTaskTitle(id: number): string {
		const t = $pmTasks.find((task) => task.id === id);
		return t ? t.title : `Task #${id}`;
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

	// --- Derived Data ---

	let task = $derived($pmTasks.find((t) => t.id === taskId));

	let subtasks = $derived(
		$pmTasks
			.filter((t) => t.parentTaskId === taskId)
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
	);

	let taskComments = $derived(
		$pmComments.filter((c) => c.targetType === 'task' && c.targetId === taskId)
	);

	let taskAttachments = $derived(
		$pmAttachments.filter((a) => a.targetType === 'task' && a.targetId === taskId)
	);

	let blockerIds = $derived(
		$pmBlocks.filter((b) => b.blockedId === taskId).map((b) => b.blockerId)
	);

	let blockedByThisIds = $derived(
		$pmBlocks.filter((b) => b.blockerId === taskId).map((b) => b.blockedId)
	);

	let taskActivities = $derived(
		[...$pmActivities]
			.filter((a) => a.targetType === 'task' && a.targetId === taskId)
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, 20)
	);

	// --- Data Loading ---

	async function loadTaskData(): Promise<void> {
		loading = true;
		errorMessage = '';
		try {
			await Promise.all([
				loadComments('task', taskId),
				loadAttachments('task', taskId),
				loadBlocks(taskId),
				loadActivities('task', taskId, 20)
			]);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load task data';
		} finally {
			loading = false;
		}
	}

	// Reload data when taskId changes
	$effect(() => {
		if (open && taskId) {
			resetEditState();
			loadTaskData();
		}
	});

	function resetEditState(): void {
		editingTitle = false;
		editingDescription = false;
		editingStatus = false;
		editingPriority = false;
		editingMilestone = false;
		editingDueDate = false;
		addingSubtask = false;
		newSubtaskTitle = '';
		newCommentBody = '';
		editingCommentId = null;
		editCommentBody = '';
		addingAttachment = false;
		newAttachmentName = '';
		newAttachmentPath = '';
		addingBlocker = false;
		addingBlocked = false;
		blockerTaskIdInput = '';
		blockedTaskIdInput = '';
		movingProject = false;
		confirmingDelete = false;
	}

	// --- Task Editing ---

	function startEditTitle(): void {
		if (!task) return;
		editTitleValue = task.title;
		editingTitle = true;
	}

	async function saveTitle(): Promise<void> {
		if (!task || !editTitleValue.trim()) return;
		editingTitle = false;
		await updateTask({ id: task.id, title: editTitleValue.trim() });
	}

	function cancelEditTitle(): void {
		editingTitle = false;
	}

	function startEditDescription(): void {
		if (!task) return;
		editDescriptionValue = task.body ?? '';
		editingDescription = true;
	}

	async function saveDescription(): Promise<void> {
		if (!task) return;
		editingDescription = false;
		await updateTask({ id: task.id, body: editDescriptionValue });
	}

	function cancelEditDescription(): void {
		editingDescription = false;
	}

	async function changeStatus(newStatus: PmStatus): Promise<void> {
		if (!task) return;
		editingStatus = false;
		await updateTask({ id: task.id, status: newStatus });
	}

	async function changePriority(newPriority: PmPriority): Promise<void> {
		if (!task) return;
		editingPriority = false;
		await updateTask({ id: task.id, priority: newPriority });
	}

	async function changeMilestone(newMilestoneId: number | undefined): Promise<void> {
		if (!task) return;
		editingMilestone = false;
		await updateTask({ id: task.id, milestoneId: newMilestoneId });
	}

	function startEditDueDate(): void {
		if (!task) return;
		editDueDateValue = task.dueDate ?? '';
		editingDueDate = true;
	}

	async function saveDueDate(): Promise<void> {
		if (!task) return;
		editingDueDate = false;
		await updateTask({ id: task.id, dueDate: editDueDateValue || undefined });
	}

	function cancelEditDueDate(): void {
		editingDueDate = false;
	}

	// --- Subtask Actions ---

	async function handleAddSubtask(): Promise<void> {
		if (!task || !newSubtaskTitle.trim()) return;
		await createTask({
			parentProjectId: task.parentProjectId,
			parentTaskId: task.id,
			title: newSubtaskTitle.trim()
		});
		newSubtaskTitle = '';
		addingSubtask = false;
	}

	function handleSubtaskKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleAddSubtask();
		} else if (event.key === 'Escape') {
			addingSubtask = false;
			newSubtaskTitle = '';
		}
	}

	async function removeSubtask(subtaskId: number): Promise<void> {
		await deleteTask(subtaskId);
	}

	function navigateToTask(id: number): void {
		dispatch('navigate', { taskId: id });
	}

	// --- Comment Actions ---

	async function handleAddComment(): Promise<void> {
		if (!newCommentBody.trim()) return;
		await createComment({
			targetType: 'task',
			targetId: taskId,
			body: newCommentBody.trim()
		});
		newCommentBody = '';
	}

	function startEditComment(comment: PmComment): void {
		editingCommentId = comment.id;
		editCommentBody = comment.body;
	}

	async function saveComment(): Promise<void> {
		if (editingCommentId == null || !editCommentBody.trim()) return;
		await updateComment({ id: editingCommentId, body: editCommentBody.trim() });
		editingCommentId = null;
		editCommentBody = '';
	}

	function cancelEditComment(): void {
		editingCommentId = null;
		editCommentBody = '';
	}

	async function handleDeleteComment(id: number): Promise<void> {
		await deleteComment(id);
	}

	// --- Attachment Actions ---

	async function handleAddAttachment(): Promise<void> {
		if (!newAttachmentName.trim() || !newAttachmentPath.trim()) return;
		await createAttachment({
			targetType: 'task',
			targetId: taskId,
			fileName: newAttachmentName.trim(),
			filePath: newAttachmentPath.trim()
		});
		newAttachmentName = '';
		newAttachmentPath = '';
		addingAttachment = false;
	}

	function handleAttachmentKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleAddAttachment();
		} else if (event.key === 'Escape') {
			addingAttachment = false;
			newAttachmentName = '';
			newAttachmentPath = '';
		}
	}

	async function handleDeleteAttachment(id: number): Promise<void> {
		await deleteAttachment(id);
	}

	// --- Blocking Actions ---

	async function handleAddBlocker(): Promise<void> {
		const blockerId = parseInt(blockerTaskIdInput, 10);
		if (isNaN(blockerId)) return;
		await createBlock({ blockerId, blockedId: taskId });
		blockerTaskIdInput = '';
		addingBlocker = false;
		await loadBlocks(taskId);
	}

	async function handleAddBlocked(): Promise<void> {
		const blockedId = parseInt(blockedTaskIdInput, 10);
		if (isNaN(blockedId)) return;
		await createBlock({ blockerId: taskId, blockedId });
		blockedTaskIdInput = '';
		addingBlocked = false;
		await loadBlocks(taskId);
	}

	async function handleRemoveBlocker(blockerId: number): Promise<void> {
		await deleteBlock({ blockerId, blockedId: taskId });
		await loadBlocks(taskId);
	}

	async function handleRemoveBlocked(blockedId: number): Promise<void> {
		await deleteBlock({ blockerId: taskId, blockedId });
		await loadBlocks(taskId);
	}

	function handleBlockerKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleAddBlocker();
		} else if (event.key === 'Escape') {
			addingBlocker = false;
			blockerTaskIdInput = '';
		}
	}

	function handleBlockedKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleAddBlocked();
		} else if (event.key === 'Escape') {
			addingBlocked = false;
			blockedTaskIdInput = '';
		}
	}

	// --- Move Task ---

	async function handleMoveToProject(newProjectId: number): Promise<void> {
		if (!task) return;
		movingProject = false;
		await moveTask({ id: task.id, parentProjectId: newProjectId });
	}

	// --- Delete Task ---

	async function handleConfirmDelete(): Promise<void> {
		if (!task) return;
		confirmingDelete = false;
		await deleteTask(task.id);
		dispatch('close');
	}

	function handleCancelDelete(): void {
		confirmingDelete = false;
	}

	// --- Close ---

	function handleClose(): void {
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40 bg-black/50 transition-opacity" onclick={handleBackdropClick}>
		<!-- Slide-out panel -->
		<div
			class="absolute bottom-0 right-0 top-0 flex w-full max-w-2xl flex-col border-l border-slate-700 bg-slate-900 shadow-2xl sm:w-[36rem]"
			role="dialog"
			aria-modal="true"
			aria-label="Task detail"
		>
			{#if loading}
				<div class="flex flex-1 items-center justify-center">
					<p class="text-sm text-slate-400">Loading task...</p>
				</div>
			{:else if errorMessage}
				<div class="flex flex-1 flex-col items-center justify-center space-y-4">
					<p class="text-sm text-red-400">{errorMessage}</p>
					<button
						onclick={handleClose}
						class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Close
					</button>
				</div>
			{:else if !task}
				<div class="flex flex-1 flex-col items-center justify-center space-y-4">
					<p class="text-sm text-slate-400">Task not found</p>
					<button
						onclick={handleClose}
						class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
					>
						Close
					</button>
				</div>
			{:else}
				<!-- Header -->
				<div class="flex items-center justify-between border-b border-slate-700 px-5 py-3">
					<div class="min-w-0 flex-1">
						{#if editingTitle}
							<input
								type="text"
								bind:value={editTitleValue}
								aria-label="Edit task title"
								onblur={saveTitle}
								onkeydown={(e) => {
									if (e.key === 'Enter') saveTitle();
									if (e.key === 'Escape') cancelEditTitle();
								}}
								class="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-base font-semibold text-slate-100 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
								autofocus
							/>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<h2
								class="cursor-pointer truncate text-base font-semibold text-slate-100 hover:text-blue-400"
								onclick={startEditTitle}
								title="Click to edit title"
							>
								{task.title}
							</h2>
						{/if}
						<p class="mt-0.5 text-xs text-slate-500">
							Task #{task.id}
							{#if task.parentProjectId}
								&middot; {getProjectTitle(task.parentProjectId)}
							{/if}
						</p>
					</div>
					<button
						onclick={handleClose}
						class="ml-3 rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
						aria-label="Close panel"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				<!-- Scrollable content -->
				<div class="flex-1 overflow-y-auto">
					<div class="p-5">
						<!-- Metadata Grid -->
						<div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
							<!-- Status -->
							<div class="relative">
								<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
									Status
								</p>
								<button
									onclick={() => (editingStatus = !editingStatus)}
									class="inline-block rounded px-2 py-0.5 text-xs font-medium {statusColor(
										task.status
									)} transition-opacity hover:opacity-80"
								>
									{statusLabel(task.status)}
								</button>
								{#if editingStatus}
									<div
										class="absolute left-0 top-full z-10 mt-1 rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
									>
										{#each Object.values(PmStatus) as s (s)}
											<button
												onclick={() => changeStatus(s)}
												class="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
											>
												{statusLabel(s)}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Priority -->
							<div class="relative">
								<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
									Priority
								</p>
								<button
									onclick={() => (editingPriority = !editingPriority)}
									class="text-xs font-medium {priorityColor(
										task.priority
									)} transition-opacity hover:opacity-80"
								>
									{priorityLabel(task.priority)}
								</button>
								{#if editingPriority}
									<div
										class="absolute left-0 top-full z-10 mt-1 rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
									>
										{#each Object.values(PmPriority) as p (p)}
											<button
												onclick={() => changePriority(p)}
												class="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
											>
												{priorityLabel(p)}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Due Date -->
							<div>
								<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
									Due Date
								</p>
								{#if editingDueDate}
									<input
										type="date"
										bind:value={editDueDateValue}
										onblur={saveDueDate}
										onkeydown={(e) => {
											if (e.key === 'Enter') saveDueDate();
											if (e.key === 'Escape') cancelEditDueDate();
										}}
										class="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
										autofocus
									/>
								{:else}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span
										class="cursor-pointer text-xs font-medium transition-opacity hover:opacity-80 {isDueOverdue(
											task.dueDate
										)
											? 'text-red-400'
											: 'text-slate-300'}"
										onclick={startEditDueDate}
										title="Click to edit due date"
									>
										{task.dueDate ? formatDueDate(task.dueDate) : 'Not set'}
									</span>
								{/if}
							</div>

							<!-- Milestone -->
							<div class="relative">
								<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
									Milestone
								</p>
								<button
									onclick={() => (editingMilestone = !editingMilestone)}
									class="text-xs font-medium text-slate-300 transition-opacity hover:opacity-80"
								>
									{getMilestoneName(task.milestoneId)}
								</button>
								{#if editingMilestone}
									<div
										class="absolute left-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
									>
										<button
											onclick={() => changeMilestone(undefined)}
											class="block w-full px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-700"
										>
											None
										</button>
										{#each $pmMilestones as ms (ms.id)}
											<button
												onclick={() => changeMilestone(ms.id)}
												class="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
											>
												{ms.name}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Project -->
							<div class="relative">
								<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
									Project
								</p>
								<button
									onclick={() => (movingProject = !movingProject)}
									class="text-xs font-medium text-slate-300 transition-opacity hover:opacity-80"
								>
									{getProjectTitle(task.parentProjectId)}
								</button>
								{#if movingProject}
									<div
										class="absolute left-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
									>
										{#each $pmProjects as proj (proj.id)}
											<button
												onclick={() => handleMoveToProject(proj.id)}
												class="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
												class:font-bold={proj.id === task.parentProjectId}
											>
												{proj.title}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Created -->
							<div>
								<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
									Created
								</p>
								<span class="text-xs text-slate-300">
									{formatDate(task.createdAt)}
								</span>
							</div>
						</div>

						<!-- Description -->
						<div class="mb-5">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">
									Description
								</h3>
								{#if !editingDescription}
									<button
										onclick={startEditDescription}
										class="text-xs text-slate-400 hover:text-slate-200"
									>
										Edit
									</button>
								{/if}
							</div>
							{#if editingDescription}
								<textarea
									bind:value={editDescriptionValue}
									rows="4"
									class="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
									placeholder="Add a description..."
								></textarea>
								<div class="mt-2 flex space-x-2">
									<button
										onclick={saveDescription}
										class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
									>
										Save
									</button>
									<button
										onclick={cancelEditDescription}
										class="rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600"
									>
										Cancel
									</button>
								</div>
							{:else}
								<div class="rounded border border-slate-700 bg-slate-800/50 px-4 py-3">
									{#if task.body}
										<p class="whitespace-pre-wrap text-sm text-slate-300">
											{task.body}
										</p>
									{:else}
										<p class="text-sm text-slate-500 italic">No description</p>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Subtasks Section -->
						<div class="mb-5">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">
									Subtasks
									<span class="ml-1 text-xs font-normal text-slate-500">
										({subtasks.length})
									</span>
								</h3>
								<button
									onclick={() => (addingSubtask = true)}
									class="text-xs text-slate-400 hover:text-slate-200"
								>
									Add
								</button>
							</div>

							{#if addingSubtask}
								<div class="mb-2 flex items-center space-x-2">
									<input
										type="text"
										bind:value={newSubtaskTitle}
										onkeydown={handleSubtaskKeydown}
										aria-label="New subtask title"
										class="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
										placeholder="Subtask title..."
										autofocus
									/>
									<button
										onclick={handleAddSubtask}
										class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
									>
										Add
									</button>
									<button
										onclick={() => {
											addingSubtask = false;
											newSubtaskTitle = '';
										}}
										class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
									>
										Cancel
									</button>
								</div>
							{/if}

							<div class="rounded border border-slate-700 bg-slate-800/50">
								{#if subtasks.length === 0 && !addingSubtask}
									<div class="p-4">
										<p class="text-sm text-slate-400 italic">No subtasks</p>
									</div>
								{:else}
									<div class="divide-y divide-slate-700/50">
										{#each subtasks as sub (sub.id)}
											<div class="group flex items-center px-3 py-2 hover:bg-slate-700/30">
												<button
													onclick={() => {
														const newSt =
															sub.status === PmStatus.DONE ? PmStatus.TODO : PmStatus.DONE;
														updateTask({
															id: sub.id,
															status: newSt
														});
													}}
													class="mr-2.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border {sub.status ===
													PmStatus.DONE
														? 'border-green-500 bg-green-500/20'
														: 'border-slate-500 hover:border-slate-400'}"
												>
													{#if sub.status === PmStatus.DONE}
														<svg
															class="h-3 w-3 text-green-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M5 13l4 4L19 7"
															/>
														</svg>
													{/if}
												</button>

												<!-- svelte-ignore a11y_click_events_have_key_events -->
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<span
													class="flex-1 cursor-pointer text-sm hover:text-blue-400 {sub.status ===
													PmStatus.DONE
														? 'text-slate-500 line-through'
														: 'text-slate-200'}"
													onclick={() => navigateToTask(sub.id)}
												>
													{sub.title}
												</span>

												{#if sub.status !== PmStatus.DONE && sub.status !== PmStatus.TODO}
													<span
														class="ml-2 rounded px-1.5 py-0.5 text-xs {statusColor(sub.status)}"
													>
														{statusLabel(sub.status)}
													</span>
												{/if}

												<button
													onclick={() => removeSubtask(sub.id)}
													class="ml-2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
													title="Remove subtask"
												>
													<svg
														class="h-3 w-3"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Blocking Section -->
						<div class="mb-5">
							<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
								Dependencies
							</h3>
							<div class="space-y-3">
								<!-- Blocked by (tasks that block this task) -->
								<div>
									<div class="mb-1 flex items-center justify-between">
										<p class="text-xs text-slate-400">
											Blocked by
											{#if blockerIds.length > 0}
												<span class="text-slate-500">
													({blockerIds.length})
												</span>
											{/if}
										</p>
										<button
											onclick={() => (addingBlocker = true)}
											class="text-xs text-slate-400 hover:text-slate-200"
										>
											Add
										</button>
									</div>

									{#if addingBlocker}
										<div class="mb-2 flex items-center space-x-2">
											<input
												type="number"
												bind:value={blockerTaskIdInput}
												onkeydown={handleBlockerKeydown}
												class="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
												placeholder="Task ID"
												autofocus
											/>
											<button
												onclick={handleAddBlocker}
												class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
											>
												Add
											</button>
											<button
												onclick={() => {
													addingBlocker = false;
													blockerTaskIdInput = '';
												}}
												class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
											>
												Cancel
											</button>
										</div>
									{/if}

									{#if blockerIds.length === 0 && !addingBlocker}
										<p class="text-xs text-slate-500 italic">None</p>
									{:else}
										<div class="space-y-1">
											{#each blockerIds as bid (bid)}
												<div class="group flex items-center rounded bg-slate-800/50 px-2 py-1">
													<!-- svelte-ignore a11y_click_events_have_key_events -->
													<!-- svelte-ignore a11y_no_static_element_interactions -->
													<span
														class="flex-1 cursor-pointer text-xs text-red-400 hover:text-red-300"
														onclick={() => navigateToTask(bid)}
													>
														#{bid}
														{getTaskTitle(bid)}
													</span>
													<button
														onclick={() => handleRemoveBlocker(bid)}
														class="rounded p-0.5 text-slate-400 opacity-0 hover:text-red-400 group-hover:opacity-100"
														title="Remove blocker"
													>
														<svg
															class="h-3 w-3"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>

								<!-- Blocks (tasks this blocks) -->
								<div>
									<div class="mb-1 flex items-center justify-between">
										<p class="text-xs text-slate-400">
											Blocks
											{#if blockedByThisIds.length > 0}
												<span class="text-slate-500">
													({blockedByThisIds.length})
												</span>
											{/if}
										</p>
										<button
											onclick={() => (addingBlocked = true)}
											class="text-xs text-slate-400 hover:text-slate-200"
										>
											Add
										</button>
									</div>

									{#if addingBlocked}
										<div class="mb-2 flex items-center space-x-2">
											<input
												type="number"
												bind:value={blockedTaskIdInput}
												onkeydown={handleBlockedKeydown}
												class="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
												placeholder="Task ID"
												autofocus
											/>
											<button
												onclick={handleAddBlocked}
												class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
											>
												Add
											</button>
											<button
												onclick={() => {
													addingBlocked = false;
													blockedTaskIdInput = '';
												}}
												class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
											>
												Cancel
											</button>
										</div>
									{/if}

									{#if blockedByThisIds.length === 0 && !addingBlocked}
										<p class="text-xs text-slate-500 italic">None</p>
									{:else}
										<div class="space-y-1">
											{#each blockedByThisIds as bid (bid)}
												<div class="group flex items-center rounded bg-slate-800/50 px-2 py-1">
													<!-- svelte-ignore a11y_click_events_have_key_events -->
													<!-- svelte-ignore a11y_no_static_element_interactions -->
													<span
														class="flex-1 cursor-pointer text-xs text-orange-400 hover:text-orange-300"
														onclick={() => navigateToTask(bid)}
													>
														#{bid}
														{getTaskTitle(bid)}
													</span>
													<button
														onclick={() => handleRemoveBlocked(bid)}
														class="rounded p-0.5 text-slate-400 opacity-0 hover:text-red-400 group-hover:opacity-100"
														title="Remove block"
													>
														<svg
															class="h-3 w-3"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Comments Section -->
						<div class="mb-5">
							<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
								Comments
								<span class="ml-1 text-xs font-normal text-slate-500">
									({taskComments.length})
								</span>
							</h3>

							<div class="rounded border border-slate-700 bg-slate-800/50">
								{#if taskComments.length === 0}
									<div class="p-3">
										<p class="text-sm text-slate-400 italic">No comments yet</p>
									</div>
								{:else}
									<div class="divide-y divide-slate-700/50">
										{#each taskComments as comment (comment.id)}
											<div class="px-3 py-2.5">
												<div class="flex items-center justify-between">
													<div class="flex items-center space-x-2">
														<span class="text-xs font-medium text-slate-200">
															{comment.author}
														</span>
														<span class="text-xs text-slate-500">
															{formatDate(comment.createdAt)}
														</span>
													</div>
													<div class="flex space-x-1">
														<button
															onclick={() => startEditComment(comment)}
															class="rounded p-1 text-slate-400 hover:text-slate-200"
															title="Edit"
														>
															<svg
																class="h-3 w-3"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
																/>
															</svg>
														</button>
														<button
															onclick={() => handleDeleteComment(comment.id)}
															class="rounded p-1 text-slate-400 hover:text-red-400"
															title="Delete"
														>
															<svg
																class="h-3 w-3"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M6 18L18 6M6 6l12 12"
																/>
															</svg>
														</button>
													</div>
												</div>
												{#if editingCommentId === comment.id}
													<textarea
														bind:value={editCommentBody}
														rows="2"
														class="mt-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
													></textarea>
													<div class="mt-1 flex space-x-2">
														<button
															onclick={saveComment}
															class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
														>
															Save
														</button>
														<button
															onclick={cancelEditComment}
															class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
														>
															Cancel
														</button>
													</div>
												{:else}
													<p class="mt-1 whitespace-pre-wrap text-sm text-slate-300">
														{comment.body}
													</p>
												{/if}
											</div>
										{/each}
									</div>
								{/if}

								<!-- Add comment -->
								<div class="border-t border-slate-700 px-3 py-2.5">
									<textarea
										bind:value={newCommentBody}
										rows="2"
										class="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
										placeholder="Write a comment..."
									></textarea>
									<div class="mt-1.5 flex justify-end">
										<button
											onclick={handleAddComment}
											disabled={!newCommentBody.trim()}
											class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
										>
											Add Comment
										</button>
									</div>
								</div>
							</div>
						</div>

						<!-- Attachments Section -->
						<div class="mb-5">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">
									Attachments
									<span class="ml-1 text-xs font-normal text-slate-500">
										({taskAttachments.length})
									</span>
								</h3>
								<button
									onclick={() => (addingAttachment = true)}
									class="text-xs text-slate-400 hover:text-slate-200"
								>
									Add
								</button>
							</div>

							{#if addingAttachment}
								<div class="mb-2">
									<input
										type="text"
										bind:value={newAttachmentName}
										onkeydown={handleAttachmentKeydown}
										class="mb-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
										placeholder="File name..."
										autofocus
									/>
									<input
										type="text"
										bind:value={newAttachmentPath}
										onkeydown={handleAttachmentKeydown}
										class="mb-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
										placeholder="File path..."
									/>
									<div class="flex space-x-2">
										<button
											onclick={handleAddAttachment}
											class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
										>
											Add
										</button>
										<button
											onclick={() => {
												addingAttachment = false;
												newAttachmentName = '';
												newAttachmentPath = '';
											}}
											class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
										>
											Cancel
										</button>
									</div>
								</div>
							{/if}

							<div class="rounded border border-slate-700 bg-slate-800/50">
								{#if taskAttachments.length === 0 && !addingAttachment}
									<div class="p-3">
										<p class="text-sm text-slate-400 italic">No attachments</p>
									</div>
								{:else}
									<div class="divide-y divide-slate-700/50">
										{#each taskAttachments as attachment (attachment.id)}
											<div class="flex items-center justify-between px-3 py-2">
												<div class="min-w-0 flex-1">
													<p class="truncate text-sm text-slate-200">
														{attachment.fileName}
													</p>
													<p class="truncate text-xs text-slate-500">
														{attachment.filePath}
													</p>
												</div>
												<button
													onclick={() => handleDeleteAttachment(attachment.id)}
													class="ml-2 rounded p-1 text-slate-400 hover:text-red-400"
													title="Remove"
												>
													<svg
														class="h-3.5 w-3.5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Activity Feed -->
						<div class="mb-5">
							<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
								Activity
							</h3>
							<div class="rounded border border-slate-700 bg-slate-800/50">
								{#if taskActivities.length === 0}
									<div class="p-3">
										<p class="text-sm text-slate-400 italic">No activity yet</p>
									</div>
								{:else}
									<div class="divide-y divide-slate-700/50">
										{#each taskActivities as activity (activity.id)}
											<div class="flex items-start space-x-2.5 px-3 py-2">
												<div class="mt-0.5 flex-shrink-0">
													<svg
														class="h-3.5 w-3.5 text-slate-400"
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
													<p class="text-xs text-slate-200">
														<span class="font-medium text-slate-100">
															{activity.actor}
														</span>
														{activity.action.replace('_', ' ')}
														{#if activity.details}
															<span class="text-slate-400">
																&mdash; {activity.details}
															</span>
														{/if}
													</p>
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
				</div>

				<!-- Footer -->
				<div class="flex items-center justify-between border-t border-slate-700 px-5 py-3">
					<button
						onclick={() => (confirmingDelete = true)}
						class="rounded bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/50"
					>
						Delete Task
					</button>
					<button
						onclick={handleClose}
						class="rounded bg-slate-700 px-4 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-600"
					>
						Close
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<ConfirmDialog
	open={confirmingDelete}
	title="Delete Task"
	message={task ? `Are you sure you want to delete "${task.title}"? This cannot be undone.` : ''}
	confirmLabel="Delete"
	onconfirm={handleConfirmDelete}
	oncancel={handleCancelDelete}
/>
