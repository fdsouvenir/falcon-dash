<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { PmStatus, PmPriority } from '$lib/types';
	import type { PmTask } from '$lib/types';
	import {
		pmTasks,
		pmFocuses,
		pmProjects,
		updateTask,
		reorderTasks,
		createTask
	} from '$lib/stores';
	import BulkActions from './BulkActions.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { longpress } from '$lib/utils/gestures';

	// Long-press context menu state for tasks
	let taskMenuOpen = false;
	let taskMenuTask: PmTask | null = null;

	function handleTaskLongPress(task: PmTask) {
		return () => {
			taskMenuTask = task;
			taskMenuOpen = true;
		};
	}

	function closeTaskMenu() {
		taskMenuOpen = false;
		taskMenuTask = null;
	}

	async function quickChangeStatus(status: PmStatus) {
		if (!taskMenuTask) return;
		await updateTask({ id: taskMenuTask.id, status });
		closeTaskMenu();
	}

	// --- Props ---

	/** Filter tasks to a specific project */
	export let selectedProjectId: number | null = null;
	/** Filter tasks by focus */
	export let selectedFocusId: string | null = null;
	/** Filter tasks by domain */
	export let selectedDomainId: string | null = null;

	const dispatch = createEventDispatcher<{
		select: { taskId: number };
	}>();

	// --- Kanban Columns ---

	const kanbanStatuses: PmStatus[] = [
		PmStatus.TODO,
		PmStatus.IN_PROGRESS,
		PmStatus.REVIEW,
		PmStatus.DONE
	];

	// --- Selection State ---

	let selectedTaskIds = new Set<number>();

	function isSelected(taskId: number): boolean {
		return selectedTaskIds.has(taskId);
	}

	function toggleSelection(e: Event, taskId: number): void {
		e.stopPropagation();
		if (selectedTaskIds.has(taskId)) {
			selectedTaskIds.delete(taskId);
		} else {
			selectedTaskIds.add(taskId);
		}
		selectedTaskIds = selectedTaskIds;
	}

	function clearSelection(): void {
		selectedTaskIds = new Set();
	}

	function selectAllTasks(): void {
		selectedTaskIds = new Set(visibleTasks.map((t) => t.id));
	}

	// --- Drag State ---

	let draggedTaskId: number | null = null;
	let dragOverColumn: PmStatus | null = null;

	// --- Add Task State ---

	let addingInColumn: PmStatus | null = null;
	let newTaskTitle = '';

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
			default:
				return s;
		}
	}

	function statusHeaderColor(s: PmStatus): string {
		switch (s) {
			case PmStatus.TODO:
				return 'bg-slate-500';
			case PmStatus.IN_PROGRESS:
				return 'bg-blue-500';
			case PmStatus.REVIEW:
				return 'bg-purple-500';
			case PmStatus.DONE:
				return 'bg-green-500';
			default:
				return 'bg-slate-500';
		}
	}

	function priorityBadgeColor(p: PmPriority | undefined): string {
		switch (p) {
			case PmPriority.URGENT:
				return 'bg-red-600/20 text-red-400';
			case PmPriority.HIGH:
				return 'bg-orange-600/20 text-orange-400';
			case PmPriority.NORMAL:
				return 'bg-slate-600/20 text-slate-300';
			case PmPriority.LOW:
				return 'bg-slate-700/20 text-slate-500';
			default:
				return '';
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

	function isDueOverdue(dateStr: string): boolean {
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return d.getTime() < now.getTime();
	}

	function getTaskDueClass(task: PmTask): string {
		if (!task.dueDate) return '';
		return isDueOverdue(task.dueDate) ? 'text-red-400' : 'text-slate-400';
	}

	function getTaskDueText(task: PmTask): string {
		if (!task.dueDate) return '';
		return formatDueDate(task.dueDate);
	}

	// --- Filtering ---

	$: domainFocusIds = selectedDomainId
		? new Set($pmFocuses.filter((f) => f.domainId === selectedDomainId).map((f) => f.id))
		: null;

	$: projectIdsInScope = (() => {
		if (selectedProjectId != null) return new Set([selectedProjectId]);
		const projects = $pmProjects.filter((p) => {
			if (selectedFocusId) return p.focusId === selectedFocusId;
			if (domainFocusIds) return domainFocusIds.has(p.focusId);
			return true;
		});
		return new Set(projects.map((p) => p.id));
	})();

	$: visibleTasks = $pmTasks.filter((t) => {
		// Must have a parent project and not be a subtask
		if (!t.parentProjectId || t.parentTaskId) return false;
		// Must be in scope
		if (!projectIdsInScope.has(t.parentProjectId)) return false;
		// Hide cancelled and archived
		if (t.status === PmStatus.CANCELLED || t.status === PmStatus.ARCHIVED) return false;
		return true;
	});

	function tasksForColumn(status: PmStatus): PmTask[] {
		return visibleTasks
			.filter((t) => t.status === status)
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
	}

	function columnCount(status: PmStatus): number {
		return visibleTasks.filter((t) => t.status === status).length;
	}

	// --- Drag and Drop ---

	function handleDragStart(e: DragEvent, taskId: number): void {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('text/plain', String(taskId));
		e.dataTransfer.effectAllowed = 'move';
		draggedTaskId = taskId;
	}

	function handleDragOver(e: DragEvent, column: PmStatus): void {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverColumn = column;
	}

	function handleDragLeave(): void {
		dragOverColumn = null;
	}

	function handleDragEnd(): void {
		draggedTaskId = null;
		dragOverColumn = null;
	}

	async function handleDrop(e: DragEvent, targetStatus: PmStatus): Promise<void> {
		e.preventDefault();
		dragOverColumn = null;

		if (!e.dataTransfer) return;
		const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
		if (isNaN(taskId)) return;

		const task = $pmTasks.find((t) => t.id === taskId);
		if (!task) return;

		if (task.status === targetStatus) {
			// Same column drop — reorder
			const columnTasks = tasksForColumn(targetStatus);
			const ids = columnTasks.map((t) => t.id);
			try {
				await reorderTasks({
					parentProjectId: task.parentProjectId,
					ids
				});
			} catch {
				// Reorder failed, no visual revert needed since order didn't change
			}
		} else {
			// Different column — update status
			try {
				await updateTask({ id: taskId, status: targetStatus });
			} catch {
				// updateTask handles revert internally
			}
		}

		draggedTaskId = null;
	}

	// --- Task Card Click ---

	function selectTask(taskId: number): void {
		dispatch('select', { taskId });
	}

	// --- Add Task ---

	function startAddTask(status: PmStatus): void {
		addingInColumn = status;
		newTaskTitle = '';
	}

	function cancelAddTask(): void {
		addingInColumn = null;
		newTaskTitle = '';
	}

	async function submitAddTask(status: PmStatus): Promise<void> {
		const title = newTaskTitle.trim();
		if (!title) return;

		const projectId = selectedProjectId ?? getFirstProjectId();
		if (projectId == null) return;

		addingInColumn = null;
		newTaskTitle = '';

		try {
			await createTask({
				parentProjectId: projectId,
				title,
				status
			});
		} catch {
			// Task creation failed — could show error toast
		}
	}

	function getFirstProjectId(): number | undefined {
		if (selectedProjectId != null) return selectedProjectId;
		const ids = Array.from(projectIdsInScope);
		return ids.length > 0 ? ids[0] : undefined;
	}

	function handleAddKeydown(e: KeyboardEvent, status: PmStatus): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			submitAddTask(status);
		} else if (e.key === 'Escape') {
			cancelAddTask();
		}
	}

	function isDragging(taskId: number): boolean {
		return draggedTaskId === taskId;
	}

	function isColumnDragOver(status: PmStatus): boolean {
		return dragOverColumn === status;
	}
</script>

<div class="flex h-full gap-4 overflow-x-auto p-4">
	{#each kanbanStatuses as status}
		<div
			class="flex w-72 min-w-[18rem] flex-shrink-0 flex-col rounded-lg border transition-colors
				{isColumnDragOver(status) ? 'border-blue-500 bg-slate-800/80' : 'border-slate-700 bg-slate-800/40'}"
			on:dragover={(e) => handleDragOver(e, status)}
			on:dragleave={handleDragLeave}
			on:drop={(e) => handleDrop(e, status)}
			role="list"
			aria-label="{statusLabel(status)} column"
		>
			<!-- Column Header -->
			<div class="flex items-center justify-between border-b border-slate-700 px-3 py-3">
				<div class="flex items-center space-x-2">
					<span class="h-2.5 w-2.5 rounded-full {statusHeaderColor(status)}"></span>
					<span class="text-sm font-medium text-slate-200">{statusLabel(status)}</span>
					<span
						class="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-700 px-1.5 text-xs text-slate-400"
					>
						{columnCount(status)}
					</span>
				</div>
				<button
					on:click={() => startAddTask(status)}
					class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
					title="Add task"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
				</button>
			</div>

			<!-- Card List -->
			<div class="flex-1 space-y-2 overflow-y-auto p-2">
				<!-- Add Task Form -->
				{#if addingInColumn === status}
					<div class="rounded-lg border border-blue-500/50 bg-slate-800 p-3">
						<input
							type="text"
							bind:value={newTaskTitle}
							on:keydown={(e) => handleAddKeydown(e, status)}
							placeholder="Task title..."
							class="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
						/>
						<div class="mt-2 flex items-center justify-end space-x-2">
							<button
								on:click={cancelAddTask}
								class="rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
							>
								Cancel
							</button>
							<button
								on:click={() => submitAddTask(status)}
								class="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
							>
								Add
							</button>
						</div>
					</div>
				{/if}

				<!-- Task Cards -->
				{#each tasksForColumn(status) as task (task.id)}
					<div
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, task.id)}
						on:dragend={handleDragEnd}
						on:click={() => selectTask(task.id)}
						use:longpress={{ onLongPress: handleTaskLongPress(task) }}
						class="cursor-pointer rounded-lg border bg-slate-800 p-3 transition-all hover:bg-slate-750
							{isDragging(task.id) ? 'opacity-50' : 'opacity-100'}
							{isSelected(task.id) ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'}"
						role="button"
						tabindex="0"
						on:keydown={(e) => {
							if (e.key === 'Enter') selectTask(task.id);
						}}
					>
						<div class="flex items-start gap-2">
							<!-- Selection Checkbox -->
							<button
								on:click={(e) => toggleSelection(e, task.id)}
								class="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors {isSelected(
									task.id
								)
									? 'border-blue-500 bg-blue-500/20'
									: 'border-slate-500 hover:border-slate-400'}"
							>
								{#if isSelected(task.id)}
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
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-slate-200">{task.title}</p>

								<div class="mt-2 flex items-center gap-2">
									{#if task.priority && priorityLabel(task.priority)}
										<span
											class="inline-block rounded px-1.5 py-0.5 text-xs font-medium {priorityBadgeColor(
												task.priority
											)}"
										>
											{priorityLabel(task.priority)}
										</span>
									{/if}

									{#if task.dueDate}
										<span class="text-xs {getTaskDueClass(task)}">
											{getTaskDueText(task)}
										</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}

				<!-- Empty Column -->
				{#if tasksForColumn(status).length === 0 && addingInColumn !== status}
					<div class="py-8 text-center">
						<p class="text-xs text-slate-500">No tasks</p>
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<BulkActions
	selectedIds={selectedTaskIds}
	totalCount={visibleTasks.length}
	on:clear={clearSelection}
	on:selectAll={selectAllTasks}
/>

<!-- Long-press task actions (bottom sheet on mobile) -->
<BottomSheet
	open={taskMenuOpen}
	title={taskMenuTask ? taskMenuTask.title : 'Task Actions'}
	on:close={closeTaskMenu}
>
	<div class="space-y-1">
		<p class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Change Status</p>
		{#each kanbanStatuses as status}
			<button
				on:click={() => quickChangeStatus(status)}
				class="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-slate-200 transition-colors hover:bg-slate-700 {taskMenuTask?.status ===
				status
					? 'bg-slate-700/50'
					: ''}"
			>
				<span class="h-2.5 w-2.5 rounded-full {statusHeaderColor(status)}"></span>
				<span>{statusLabel(status)}</span>
				{#if taskMenuTask?.status === status}
					<span class="ml-auto text-xs text-slate-400">Current</span>
				{/if}
			</button>
		{/each}
		<div class="border-t border-slate-700 pt-2">
			<button
				on:click={() => {
					if (taskMenuTask) selectTask(taskMenuTask.id);
					closeTaskMenu();
				}}
				class="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-slate-200 transition-colors hover:bg-slate-700"
			>
				<svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					/>
				</svg>
				<span>View Details</span>
			</button>
		</div>
	</div>
</BottomSheet>
