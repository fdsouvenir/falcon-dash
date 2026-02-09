<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { PmStatus, PmPriority } from '$lib/types';
	import type { PmTask, PmComment, PmActivity } from '$lib/types';
	import {
		pmProjects,
		pmTasks,
		pmComments,
		pmAttachments,
		pmActivities,
		pmFocuses,
		pmMilestones,
		loadProjects,
		loadTasks,
		loadComments,
		loadAttachments,
		loadActivities,
		loadFocuses,
		loadMilestones,
		loadBlocks,
		updateProject,
		createTask,
		updateTask,
		deleteTask,
		createComment,
		updateComment,
		deleteComment,
		createAttachment,
		deleteAttachment,
		initPmListeners,
		destroyPmListeners
	} from '$lib/stores';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';
	import BulkActions from '$lib/components/pm/BulkActions.svelte';

	// --- State ---

	let loading = $state(true);
	let errorMessage = $state('');
	let projectId = $state<number>(0);

	// Selection state
	let selectedTaskIds = $state(new Set<number>());

	function isTaskSelected(taskId: number): boolean {
		return selectedTaskIds.has(taskId);
	}

	function toggleTaskSelection(e: Event, taskId: number): void {
		e.stopPropagation();
		if (selectedTaskIds.has(taskId)) {
			selectedTaskIds.delete(taskId);
		} else {
			selectedTaskIds.add(taskId);
		}
		selectedTaskIds = selectedTaskIds;
	}

	function clearTaskSelection(): void {
		selectedTaskIds = new Set();
	}

	function selectAllProjectTasks(): void {
		selectedTaskIds = new Set(projectTasks.map((t) => t.id));
	}

	// Editing state
	let editingTitle = $state(false);
	let editTitleValue = $state('');
	let editingDescription = $state(false);
	let editDescriptionValue = $state('');
	let editingStatus = $state(false);
	let editingPriority = $state(false);
	let editingFocus = $state(false);
	let editingMilestone = $state(false);
	let editingDueDate = $state(false);
	let editDueDateValue = $state('');

	// New task state
	let newTaskTitle = $state('');
	let addingTask = $state(false);
	let addingSubtaskFor = $state<number | null>(null);
	let newSubtaskTitle = $state('');

	// Comment state
	let newCommentBody = $state('');
	let editingCommentId = $state<number | null>(null);
	let editCommentBody = $state('');

	// Attachment state
	let newAttachmentName = $state('');
	let newAttachmentPath = $state('');
	let addingAttachment = $state(false);

	// Delete confirmation
	let confirmDeleteTask = $state<PmTask | null>(null);

	// Collapsed tasks
	let collapsedTasks = $state(new Set<number>());

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

	function toStatus(val: string): PmStatus {
		return val as PmStatus;
	}

	function isDueOverdue(dateStr: string | undefined): boolean {
		if (!dateStr) return false;
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return d.getTime() < now.getTime();
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

	function getFocusName(focusId: string | undefined): string {
		if (!focusId) return '';
		const focus = $pmFocuses.find((f) => f.id === focusId);
		return focus ? focus.name : focusId;
	}

	function getMilestoneName(milestoneId: number | undefined): string {
		if (milestoneId == null) return 'None';
		const ms = $pmMilestones.find((m) => m.id === milestoneId);
		return ms ? ms.name : `#${milestoneId}`;
	}

	// --- Derived Data ---

	let project = $derived($pmProjects.find((p) => p.id === projectId));

	let projectTasks = $derived($pmTasks.filter((t) => t.parentProjectId === projectId));

	let rootTasks = $derived(
		projectTasks
			.filter((t) => !t.parentTaskId)
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
	);

	let projectComments = $derived(
		$pmComments.filter((c) => c.targetType === 'project' && c.targetId === projectId)
	);

	let projectAttachments = $derived(
		$pmAttachments.filter((a) => a.targetType === 'project' && a.targetId === projectId)
	);

	let projectActivities = $derived(
		[...$pmActivities]
			.filter((a) => a.projectId === projectId)
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, 30)
	);

	function getSubtasks(parentId: number): PmTask[] {
		return projectTasks
			.filter((t) => t.parentTaskId === parentId)
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
	}

	function hasSubtasks(taskId: number): boolean {
		return projectTasks.some((t) => t.parentTaskId === taskId);
	}

	function isTaskCollapsed(taskId: number): boolean {
		return collapsedTasks.has(taskId);
	}

	function toggleCollapse(taskId: number): void {
		if (collapsedTasks.has(taskId)) {
			collapsedTasks.delete(taskId);
		} else {
			collapsedTasks.add(taskId);
		}
		collapsedTasks = collapsedTasks;
	}

	// --- Project Editing ---

	function startEditTitle(): void {
		if (!project) return;
		editTitleValue = project.title;
		editingTitle = true;
	}

	async function saveTitle(): Promise<void> {
		if (!project || !editTitleValue.trim()) return;
		editingTitle = false;
		await updateProject({ id: project.id, title: editTitleValue.trim() });
	}

	function cancelEditTitle(): void {
		editingTitle = false;
	}

	function startEditDescription(): void {
		if (!project) return;
		editDescriptionValue = project.description ?? '';
		editingDescription = true;
	}

	async function saveDescription(): Promise<void> {
		if (!project) return;
		editingDescription = false;
		await updateProject({ id: project.id, description: editDescriptionValue });
	}

	function cancelEditDescription(): void {
		editingDescription = false;
	}

	async function changeStatus(newStatus: PmStatus): Promise<void> {
		if (!project) return;
		editingStatus = false;
		await updateProject({ id: project.id, status: newStatus });
	}

	async function changePriority(newPriority: PmPriority): Promise<void> {
		if (!project) return;
		editingPriority = false;
		await updateProject({ id: project.id, priority: newPriority });
	}

	async function changeFocus(newFocusId: string): Promise<void> {
		if (!project) return;
		editingFocus = false;
		await updateProject({ id: project.id, focusId: newFocusId });
	}

	async function changeMilestone(newMilestoneId: number | undefined): Promise<void> {
		if (!project) return;
		editingMilestone = false;
		await updateProject({ id: project.id, milestoneId: newMilestoneId });
	}

	function startEditDueDate(): void {
		if (!project) return;
		editDueDateValue = project.dueDate ?? '';
		editingDueDate = true;
	}

	async function saveDueDate(): Promise<void> {
		if (!project) return;
		editingDueDate = false;
		await updateProject({ id: project.id, dueDate: editDueDateValue || undefined });
	}

	function cancelEditDueDate(): void {
		editingDueDate = false;
	}

	// --- Task Actions ---

	async function handleAddTask(): Promise<void> {
		if (!newTaskTitle.trim()) return;
		await createTask({ parentProjectId: projectId, title: newTaskTitle.trim() });
		newTaskTitle = '';
		addingTask = false;
	}

	function handleAddTaskKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			handleAddTask();
		} else if (event.key === 'Escape') {
			addingTask = false;
			newTaskTitle = '';
		}
	}

	async function handleAddSubtask(parentTaskId: number): Promise<void> {
		if (!newSubtaskTitle.trim()) return;
		await createTask({
			parentProjectId: projectId,
			parentTaskId,
			title: newSubtaskTitle.trim()
		});
		newSubtaskTitle = '';
		addingSubtaskFor = null;
	}

	function handleSubtaskKeydown(event: KeyboardEvent, parentTaskId: number): void {
		if (event.key === 'Enter') {
			handleAddSubtask(parentTaskId);
		} else if (event.key === 'Escape') {
			addingSubtaskFor = null;
			newSubtaskTitle = '';
		}
	}

	async function toggleTaskDone(task: PmTask): Promise<void> {
		const newStatus = task.status === PmStatus.DONE ? PmStatus.TODO : PmStatus.DONE;
		await updateTask({ id: task.id, status: newStatus });
	}

	async function changeTaskStatus(task: PmTask, newStatus: PmStatus): Promise<void> {
		await updateTask({ id: task.id, status: newStatus });
	}

	function handleDeleteTask(task: PmTask): void {
		confirmDeleteTask = task;
	}

	async function confirmDelete(): Promise<void> {
		if (!confirmDeleteTask) return;
		await deleteTask(confirmDeleteTask.id);
		confirmDeleteTask = null;
	}

	function cancelDelete(): void {
		confirmDeleteTask = null;
	}

	// --- Comment Actions ---

	async function handleAddComment(): Promise<void> {
		if (!newCommentBody.trim()) return;
		await createComment({
			targetType: 'project',
			targetId: projectId,
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
			targetType: 'project',
			targetId: projectId,
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

	// --- Navigation ---

	function goBack(): void {
		goto('/projects');
	}

	// --- Lifecycle ---

	onMount(async () => {
		projectId = Number($page.params.id);
		if (isNaN(projectId)) {
			errorMessage = 'Invalid project ID';
			loading = false;
			return;
		}

		initPmListeners();
		try {
			await Promise.all([
				loadProjects(),
				loadTasks(projectId),
				loadComments('project', projectId),
				loadAttachments('project', projectId),
				loadActivities(undefined, undefined, 30),
				loadFocuses(),
				loadMilestones(),
				loadBlocks()
			]);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load project';
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
			<p class="text-sm text-slate-400">Loading project...</p>
		</div>
	{:else if errorMessage}
		<div class="flex flex-1 flex-col items-center justify-center space-y-4">
			<p class="text-sm text-red-400">{errorMessage}</p>
			<button
				onclick={goBack}
				class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
			>
				Back to Projects
			</button>
		</div>
	{:else if !project}
		<div class="flex flex-1 flex-col items-center justify-center space-y-4">
			<p class="text-sm text-slate-400">Project not found</p>
			<button
				onclick={goBack}
				class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600"
			>
				Back to Projects
			</button>
		</div>
	{:else}
		<!-- Top Bar -->
		<div class="flex items-center border-b border-slate-700 px-6 py-3">
			<button
				onclick={goBack}
				class="mr-3 rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
				aria-label="Back to projects"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
			</button>
			<div class="min-w-0 flex-1">
				{#if editingTitle}
					<input
						type="text"
						bind:value={editTitleValue}
						onblur={saveTitle}
						onkeydown={(e) => {
							if (e.key === 'Enter') saveTitle();
							if (e.key === 'Escape') cancelEditTitle();
						}}
						class="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-lg font-semibold text-slate-100 outline-none focus:border-blue-500"
						autofocus
					/>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<h1
						class="cursor-pointer truncate text-lg font-semibold text-slate-100 hover:text-blue-400"
						onclick={startEditTitle}
						title="Click to edit title"
					>
						{project.title}
					</h1>
				{/if}
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-5xl p-6">
				<!-- Metadata Grid -->
				<div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					<!-- Status -->
					<div class="relative">
						<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Status</p>
						<button
							onclick={() => (editingStatus = !editingStatus)}
							class="inline-block rounded px-2 py-1 text-xs font-medium {statusColor(
								project.status
							)} transition-opacity hover:opacity-80"
						>
							{statusLabel(project.status)}
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
						<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Priority</p>
						<button
							onclick={() => (editingPriority = !editingPriority)}
							class="text-xs font-medium {priorityColor(
								project.priority
							)} transition-opacity hover:opacity-80"
						>
							{priorityLabel(project.priority)}
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

					<!-- Focus -->
					<div class="relative">
						<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Focus</p>
						<button
							onclick={() => (editingFocus = !editingFocus)}
							class="text-xs font-medium text-slate-300 transition-opacity hover:opacity-80"
						>
							{getFocusName(project.focusId)}
						</button>
						{#if editingFocus}
							<div
								class="absolute left-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
							>
								{#each $pmFocuses as f (f.id)}
									<button
										onclick={() => changeFocus(f.id)}
										class="block w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
									>
										{f.name}
									</button>
								{/each}
							</div>
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
							{getMilestoneName(project.milestoneId)}
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

					<!-- Due Date -->
					<div>
						<p class="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Due Date</p>
						{#if editingDueDate}
							<input
								type="date"
								bind:value={editDueDateValue}
								onblur={saveDueDate}
								onkeydown={(e) => {
									if (e.key === 'Enter') saveDueDate();
									if (e.key === 'Escape') cancelEditDueDate();
								}}
								class="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-blue-500"
								autofocus
							/>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span
								class="cursor-pointer text-xs font-medium transition-opacity hover:opacity-80 {isDueOverdue(
									project.dueDate
								)
									? 'text-red-400'
									: 'text-slate-300'}"
								onclick={startEditDueDate}
								title="Click to edit due date"
							>
								{project.dueDate ? formatDueDate(project.dueDate) : 'Not set'}
							</span>
						{/if}
					</div>
				</div>

				<!-- Description -->
				<div class="mb-6">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
							Description
						</h2>
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
							class="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
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
							{#if project.description}
								<p class="whitespace-pre-wrap text-sm text-slate-300">
									{project.description}
								</p>
							{:else}
								<p class="text-sm text-slate-500 italic">No description</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Task Tree Section -->
				<div class="mb-6">
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
							Tasks
							<span class="ml-1 text-xs font-normal text-slate-500">
								({projectTasks.length})
							</span>
						</h2>
						<button
							onclick={() => (addingTask = true)}
							class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
						>
							Add Task
						</button>
					</div>

					<!-- Add task inline form -->
					{#if addingTask}
						<div class="mb-3 flex items-center space-x-2">
							<input
								type="text"
								bind:value={newTaskTitle}
								onkeydown={handleAddTaskKeydown}
								class="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
								placeholder="New task title..."
								autofocus
							/>
							<button
								onclick={handleAddTask}
								class="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
							>
								Add
							</button>
							<button
								onclick={() => {
									addingTask = false;
									newTaskTitle = '';
								}}
								class="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600"
							>
								Cancel
							</button>
						</div>
					{/if}

					<!-- Task Tree -->
					<div class="rounded border border-slate-700 bg-slate-800/50">
						{#if rootTasks.length === 0 && !addingTask}
							<div class="flex items-center justify-center p-6">
								<p class="text-sm text-slate-400">No tasks yet</p>
							</div>
						{:else}
							<div class="divide-y divide-slate-700/50">
								{#each rootTasks as task (task.id)}
									<div>
										<!-- Task row -->
										<div class="group flex items-center px-4 py-2.5 hover:bg-slate-700/30">
											<!-- Selection checkbox -->
											<button
												onclick={(e) => toggleTaskSelection(e, task.id)}
												class="mr-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors {isTaskSelected(
													task.id
												)
													? 'border-blue-500 bg-blue-500/20'
													: 'border-slate-500 hover:border-slate-400'}"
											>
												{#if isTaskSelected(task.id)}
													<svg
														class="h-3 w-3 text-blue-400"
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

											<!-- Collapse toggle -->
											<button
												onclick={() => toggleCollapse(task.id)}
												class="mr-2 flex h-5 w-5 items-center justify-center text-slate-500 hover:text-slate-300"
												class:invisible={!hasSubtasks(task.id)}
											>
												<svg
													class="h-3 w-3 transition-transform"
													class:rotate-90={!isTaskCollapsed(task.id)}
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 5l7 7-7 7"
													/>
												</svg>
											</button>

											<!-- Checkbox -->
											<button
												onclick={() => toggleTaskDone(task)}
												class="mr-3 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border {task.status ===
												PmStatus.DONE
													? 'border-green-500 bg-green-500/20'
													: 'border-slate-500 hover:border-slate-400'}"
											>
												{#if task.status === PmStatus.DONE}
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

											<!-- Title -->
											<span
												class="flex-1 text-sm {task.status === PmStatus.DONE
													? 'text-slate-500 line-through'
													: 'text-slate-200'}"
											>
												{task.title}
											</span>

											<!-- Status badge (when not done/todo) -->
											{#if task.status !== PmStatus.DONE && task.status !== PmStatus.TODO}
												<span class="ml-2 rounded px-1.5 py-0.5 text-xs {statusColor(task.status)}">
													{statusLabel(task.status)}
												</span>
											{/if}

											<!-- Priority -->
											{#if task.priority && task.priority !== PmPriority.NORMAL}
												<span class="ml-2 text-xs {priorityColor(task.priority)}">
													{priorityLabel(task.priority)}
												</span>
											{/if}

											<!-- Due date -->
											{#if task.dueDate}
												<span
													class="ml-2 text-xs {isDueOverdue(task.dueDate)
														? 'text-red-400'
														: 'text-slate-500'}"
												>
													{formatDueDate(task.dueDate)}
												</span>
											{/if}

											<!-- Actions -->
											<div
												class="ml-2 flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100"
											>
												<!-- Status dropdown trigger -->
												<select
													onchange={(e) => {
														const target = e.target;
														if (target instanceof HTMLSelectElement) {
															changeTaskStatus(task, toStatus(target.value));
														}
													}}
													class="h-6 rounded border border-slate-600 bg-slate-800 px-1 text-xs text-slate-300"
												>
													{#each Object.values(PmStatus) as s (s)}
														<option value={s} selected={s === task.status}>
															{statusLabel(s)}
														</option>
													{/each}
												</select>

												<!-- Add subtask -->
												<button
													onclick={() => (addingSubtaskFor = task.id)}
													class="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
													title="Add subtask"
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
															d="M12 4v16m8-8H4"
														/>
													</svg>
												</button>

												<!-- Delete -->
												<button
													onclick={() => handleDeleteTask(task)}
													class="rounded p-1 text-slate-400 hover:bg-red-900/30 hover:text-red-400"
													title="Delete task"
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
															d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
														/>
													</svg>
												</button>
											</div>
										</div>

										<!-- Add subtask inline -->
										{#if addingSubtaskFor === task.id}
											<div class="flex items-center space-x-2 py-2 pl-14 pr-4">
												<input
													type="text"
													bind:value={newSubtaskTitle}
													onkeydown={(e) => handleSubtaskKeydown(e, task.id)}
													class="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500"
													placeholder="Subtask title..."
													autofocus
												/>
												<button
													onclick={() => handleAddSubtask(task.id)}
													class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
												>
													Add
												</button>
												<button
													onclick={() => {
														addingSubtaskFor = null;
														newSubtaskTitle = '';
													}}
													class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
												>
													Cancel
												</button>
											</div>
										{/if}

										<!-- Subtasks (recursive via nesting depth) -->
										{#if !isTaskCollapsed(task.id) && hasSubtasks(task.id)}
											{#each getSubtasks(task.id) as subtask (subtask.id)}
												<div>
													<div
														class="group flex items-center py-2.5 pl-12 pr-4 hover:bg-slate-700/30"
													>
														<!-- Selection checkbox -->
														<button
															onclick={(e) => toggleTaskSelection(e, subtask.id)}
															class="mr-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors {isTaskSelected(
																subtask.id
															)
																? 'border-blue-500 bg-blue-500/20'
																: 'border-slate-500 hover:border-slate-400'}"
														>
															{#if isTaskSelected(subtask.id)}
																<svg
																	class="h-3 w-3 text-blue-400"
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

														<!-- Collapse toggle for nested -->
														<button
															onclick={() => toggleCollapse(subtask.id)}
															class="mr-2 flex h-5 w-5 items-center justify-center text-slate-500 hover:text-slate-300"
															class:invisible={!hasSubtasks(subtask.id)}
														>
															<svg
																class="h-3 w-3 transition-transform"
																class:rotate-90={!isTaskCollapsed(subtask.id)}
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M9 5l7 7-7 7"
																/>
															</svg>
														</button>

														<button
															onclick={() => toggleTaskDone(subtask)}
															class="mr-3 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border {subtask.status ===
															PmStatus.DONE
																? 'border-green-500 bg-green-500/20'
																: 'border-slate-500 hover:border-slate-400'}"
														>
															{#if subtask.status === PmStatus.DONE}
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

														<span
															class="flex-1 text-sm {subtask.status === PmStatus.DONE
																? 'text-slate-500 line-through'
																: 'text-slate-200'}"
														>
															{subtask.title}
														</span>

														{#if subtask.status !== PmStatus.DONE && subtask.status !== PmStatus.TODO}
															<span
																class="ml-2 rounded px-1.5 py-0.5 text-xs {statusColor(
																	subtask.status
																)}"
															>
																{statusLabel(subtask.status)}
															</span>
														{/if}

														{#if subtask.priority && subtask.priority !== PmPriority.NORMAL}
															<span class="ml-2 text-xs {priorityColor(subtask.priority)}">
																{priorityLabel(subtask.priority)}
															</span>
														{/if}

														{#if subtask.dueDate}
															<span
																class="ml-2 text-xs {isDueOverdue(subtask.dueDate)
																	? 'text-red-400'
																	: 'text-slate-500'}"
															>
																{formatDueDate(subtask.dueDate)}
															</span>
														{/if}

														<div
															class="ml-2 flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100"
														>
															<select
																onchange={(e) => {
																	const target = e.target;
																	if (target instanceof HTMLSelectElement) {
																		changeTaskStatus(subtask, toStatus(target.value));
																	}
																}}
																class="h-6 rounded border border-slate-600 bg-slate-800 px-1 text-xs text-slate-300"
															>
																{#each Object.values(PmStatus) as s (s)}
																	<option value={s} selected={s === subtask.status}>
																		{statusLabel(s)}
																	</option>
																{/each}
															</select>

															<button
																onclick={() => (addingSubtaskFor = subtask.id)}
																class="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
																title="Add subtask"
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
																		d="M12 4v16m8-8H4"
																	/>
																</svg>
															</button>

															<button
																onclick={() => handleDeleteTask(subtask)}
																class="rounded p-1 text-slate-400 hover:bg-red-900/30 hover:text-red-400"
																title="Delete task"
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
																		d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
																	/>
																</svg>
															</button>
														</div>
													</div>

													<!-- Add subtask for nested -->
													{#if addingSubtaskFor === subtask.id}
														<div class="flex items-center space-x-2 py-2 pl-24 pr-4">
															<input
																type="text"
																bind:value={newSubtaskTitle}
																onkeydown={(e) => handleSubtaskKeydown(e, subtask.id)}
																class="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500"
																placeholder="Subtask title..."
																autofocus
															/>
															<button
																onclick={() => handleAddSubtask(subtask.id)}
																class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
															>
																Add
															</button>
															<button
																onclick={() => {
																	addingSubtaskFor = null;
																	newSubtaskTitle = '';
																}}
																class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
															>
																Cancel
															</button>
														</div>
													{/if}

													<!-- Third level subtasks -->
													{#if !isTaskCollapsed(subtask.id) && hasSubtasks(subtask.id)}
														{#each getSubtasks(subtask.id) as subsubtask (subsubtask.id)}
															<div
																class="group flex items-center py-2 pl-20 pr-4 hover:bg-slate-700/30"
															>
																<!-- Selection checkbox -->
																<button
																	onclick={(e) => toggleTaskSelection(e, subsubtask.id)}
																	class="mr-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors {isTaskSelected(
																		subsubtask.id
																	)
																		? 'border-blue-500 bg-blue-500/20'
																		: 'border-slate-500 hover:border-slate-400'}"
																>
																	{#if isTaskSelected(subsubtask.id)}
																		<svg
																			class="h-3 w-3 text-blue-400"
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

																<button
																	onclick={() => toggleTaskDone(subsubtask)}
																	class="mr-3 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border {subsubtask.status ===
																	PmStatus.DONE
																		? 'border-green-500 bg-green-500/20'
																		: 'border-slate-500 hover:border-slate-400'}"
																>
																	{#if subsubtask.status === PmStatus.DONE}
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

																<span
																	class="flex-1 text-sm {subsubtask.status === PmStatus.DONE
																		? 'text-slate-500 line-through'
																		: 'text-slate-200'}"
																>
																	{subsubtask.title}
																</span>

																{#if subsubtask.status !== PmStatus.DONE && subsubtask.status !== PmStatus.TODO}
																	<span
																		class="ml-2 rounded px-1.5 py-0.5 text-xs {statusColor(
																			subsubtask.status
																		)}"
																	>
																		{statusLabel(subsubtask.status)}
																	</span>
																{/if}

																<div
																	class="ml-2 flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100"
																>
																	<button
																		onclick={() => handleDeleteTask(subsubtask)}
																		class="rounded p-1 text-slate-400 hover:bg-red-900/30 hover:text-red-400"
																		title="Delete task"
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
																				d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
																			/>
																		</svg>
																	</button>
																</div>
															</div>
														{/each}
													{/if}
												</div>
											{/each}
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Bottom panels: Comments + Attachments + Activity in a grid -->
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Comments Section -->
					<div class="rounded border border-slate-700 bg-slate-800/50">
						<div class="border-b border-slate-700 px-4 py-3">
							<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
								Comments
								<span class="ml-1 text-xs font-normal text-slate-500">
									({projectComments.length})
								</span>
							</h2>
						</div>

						{#if projectComments.length === 0}
							<div class="p-4">
								<p class="text-sm text-slate-400 italic">No comments yet</p>
							</div>
						{:else}
							<div class="divide-y divide-slate-700/50">
								{#each projectComments as comment (comment.id)}
									<div class="px-4 py-3">
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
												class="mt-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500"
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
						<div class="border-t border-slate-700 px-4 py-3">
							<textarea
								bind:value={newCommentBody}
								rows="2"
								class="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
								placeholder="Write a comment..."
							></textarea>
							<div class="mt-2 flex justify-end">
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

					<!-- Right column: Attachments + Activity -->
					<div class="space-y-6">
						<!-- Attachments Section -->
						<div class="rounded border border-slate-700 bg-slate-800/50">
							<div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
								<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
									Attachments
									<span class="ml-1 text-xs font-normal text-slate-500">
										({projectAttachments.length})
									</span>
								</h2>
								<button
									onclick={() => (addingAttachment = true)}
									class="text-xs text-slate-400 hover:text-slate-200"
								>
									Add
								</button>
							</div>

							{#if addingAttachment}
								<div class="border-b border-slate-700/50 px-4 py-3">
									<input
										type="text"
										bind:value={newAttachmentName}
										onkeydown={handleAttachmentKeydown}
										class="mb-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500"
										placeholder="File name..."
										autofocus
									/>
									<input
										type="text"
										bind:value={newAttachmentPath}
										onkeydown={handleAttachmentKeydown}
										class="mb-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 outline-none focus:border-blue-500"
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

							{#if projectAttachments.length === 0 && !addingAttachment}
								<div class="p-4">
									<p class="text-sm text-slate-400 italic">No attachments</p>
								</div>
							{:else}
								<div class="divide-y divide-slate-700/50">
									{#each projectAttachments as attachment (attachment.id)}
										<div class="flex items-center justify-between px-4 py-2">
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

						<!-- Activity Feed Section -->
						<div class="rounded border border-slate-700 bg-slate-800/50">
							<div class="border-b border-slate-700 px-4 py-3">
								<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">
									Activity
								</h2>
							</div>
							{#if projectActivities.length === 0}
								<div class="p-4">
									<p class="text-sm text-slate-400 italic">No activity yet</p>
								</div>
							{:else}
								<div class="divide-y divide-slate-700/50">
									{#each projectActivities as activity (activity.id)}
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
													<span class="font-medium text-slate-100">
														{activity.actor}
													</span>
													{activity.action.replace('_', ' ')}
													{activity.targetType}
													{#if activity.targetTitle}
														<span class="text-slate-300">
															"{activity.targetTitle}"
														</span>
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
			</div>
		</div>
	{/if}
</div>

<BulkActions
	selectedIds={selectedTaskIds}
	totalCount={projectTasks.length}
	on:clear={clearTaskSelection}
	on:selectAll={selectAllProjectTasks}
/>

<ConfirmDialog
	open={confirmDeleteTask != null}
	title="Delete Task"
	message={confirmDeleteTask
		? `Are you sure you want to delete "${confirmDeleteTask.title}"? This cannot be undone.`
		: ''}
	confirmLabel="Delete"
	on:confirm={confirmDelete}
	on:cancel={cancelDelete}
/>
