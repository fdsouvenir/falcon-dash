<script lang="ts">
	import { updateTask, reorderTasks, type Task } from '$lib/stores/pm-projects.js';

	let { tasks = [], onTaskClick = null as ((task: Task) => void) | null } = $props();

	const COLUMNS = [
		{ key: 'todo', label: 'To Do', color: 'border-gray-600' },
		{ key: 'in_progress', label: 'In Progress', color: 'border-blue-500' },
		{ key: 'review', label: 'Review', color: 'border-yellow-500' },
		{ key: 'done', label: 'Done', color: 'border-green-500' }
	];

	// Filters
	let filterProject = $state<number | null>(null);
	let filterPriority = $state<string | null>(null);

	// Get unique projects from tasks
	let projects = $derived(
		Array.from(new Set(tasks.map((t) => t.parent_project_id).filter((id) => id !== null)))
	);

	// Filtered tasks
	let filteredTasks = $derived(
		tasks.filter((t) => {
			if (filterProject !== null && t.parent_project_id !== filterProject) return false;
			if (filterPriority && t.priority !== filterPriority) return false;
			return true;
		})
	);

	// Group by status
	let columns = $derived(
		COLUMNS.map((col) => ({
			...col,
			tasks: filteredTasks
				.filter((t) => t.status === col.key)
				.sort((a, b) => a.sort_order - b.sort_order)
		}))
	);

	// Drag state
	let draggedTaskId = $state<number | null>(null);
	let dragOverColumn = $state<string | null>(null);
	let dragOverTaskId = $state<number | null>(null);

	function handleDragStart(e: DragEvent, task: Task) {
		draggedTaskId = task.id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(task.id));
		}
	}

	function handleDragOver(e: DragEvent, columnKey: string, taskId?: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverColumn = columnKey;
		dragOverTaskId = taskId ?? null;
	}

	function handleDragLeave() {
		dragOverColumn = null;
		dragOverTaskId = null;
	}

	async function handleDrop(e: DragEvent, columnKey: string) {
		e.preventDefault();
		if (draggedTaskId === null) return;

		const task = tasks.find((t) => t.id === draggedTaskId);
		if (!task) return;

		// If moved to different column, update status
		if (task.status !== columnKey) {
			await updateTask(draggedTaskId, { status: columnKey });
		}

		// If dropped on a specific task, reorder
		if (dragOverTaskId !== null && dragOverTaskId !== draggedTaskId) {
			const columnTasks = filteredTasks
				.filter((t) => t.status === columnKey)
				.sort((a, b) => a.sort_order - b.sort_order);
			const ids = columnTasks.map((t) => t.id);

			// Remove dragged
			const fromIdx = ids.indexOf(draggedTaskId);
			if (fromIdx === -1)
				ids.push(draggedTaskId); // new to column
			else ids.splice(fromIdx, 1);

			// Insert at target position
			const toIdx = ids.indexOf(dragOverTaskId);
			ids.splice(toIdx, 0, draggedTaskId);

			await reorderTasks(ids);
		}

		draggedTaskId = null;
		dragOverColumn = null;
		dragOverTaskId = null;
	}

	function handleDragEnd() {
		draggedTaskId = null;
		dragOverColumn = null;
		dragOverTaskId = null;
	}

	function priorityBadge(priority: string | null): { text: string; class: string } {
		switch (priority) {
			case 'urgent':
				return { text: 'Urgent', class: 'bg-red-600 text-white' };
			case 'high':
				return { text: 'High', class: 'bg-orange-600 text-white' };
			case 'normal':
				return { text: 'Normal', class: 'bg-yellow-600 text-white' };
			case 'low':
				return { text: 'Low', class: 'bg-gray-600 text-white' };
			default:
				return { text: '', class: '' };
		}
	}

	function formatDueDate(date: string | null): string {
		if (!date) return '';
		const d = new Date(date);
		const now = new Date();
		const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		return `${diffDays}d`;
	}

	// Count subtasks for a task
	function subtaskCount(taskId: number): number {
		return tasks.filter((t) => t.parent_task_id === taskId).length;
	}

	// Check if blocked
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function isBlocked(taskId: number): boolean {
		// Blocked tasks would have blockers — for now check if any task blocks this one
		// This is a simplified check; real blocked state comes from blocks table
		return false; // Will be enhanced when block data is available on tasks
	}

	function clearFilters() {
		filterProject = null;
		filterPriority = null;
	}
</script>

<div class="flex h-full flex-col bg-gray-900 text-white">
	<!-- Filter bar -->
	<div class="flex items-center gap-4 border-b border-gray-700 p-4">
		<div class="flex items-center gap-2">
			<label for="filter-project" class="text-sm text-gray-400">Project:</label>
			<select
				id="filter-project"
				bind:value={filterProject}
				class="rounded bg-gray-800 px-3 py-1 text-sm text-white"
			>
				<option value={null}>All Projects</option>
				{#each projects as projectId (projectId)}
					<option value={projectId}>Project {projectId}</option>
				{/each}
			</select>
		</div>

		<div class="flex items-center gap-2">
			<label for="filter-priority" class="text-sm text-gray-400">Priority:</label>
			<select
				id="filter-priority"
				bind:value={filterPriority}
				class="rounded bg-gray-800 px-3 py-1 text-sm text-white"
			>
				<option value={null}>All Priorities</option>
				<option value="urgent">Urgent</option>
				<option value="high">High</option>
				<option value="normal">Normal</option>
				<option value="low">Low</option>
			</select>
		</div>

		{#if filterProject !== null || filterPriority !== null}
			<button onclick={clearFilters} class="text-sm text-blue-400 hover:text-blue-300">
				Clear Filters
			</button>
		{/if}

		<div class="ml-auto text-sm text-gray-400">
			{filteredTasks.length}
			{filteredTasks.length === 1 ? 'task' : 'tasks'}
		</div>
	</div>

	<!-- Kanban columns -->
	<div class="flex flex-1 gap-4 overflow-x-auto p-4">
		{#each columns as column (column.key)}
			<div
				class="flex w-80 flex-shrink-0 flex-col rounded-lg bg-gray-800"
				ondragover={(e) => handleDragOver(e, column.key)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, column.key)}
			>
				<!-- Column header -->
				<div class="flex items-center justify-between border-b-2 {column.color} p-3">
					<h3 class="font-semibold">{column.label}</h3>
					<span class="text-sm text-gray-400">{column.tasks.length}</span>
				</div>

				<!-- Column content -->
				<div class="flex-1 overflow-y-auto p-2 space-y-2">
					{#if column.tasks.length === 0}
						<div class="flex h-32 items-center justify-center text-sm text-gray-500">
							{#if dragOverColumn === column.key}
								Drop task here
							{:else}
								No tasks
							{/if}
						</div>
					{:else}
						{#each column.tasks as task (task.id)}
							<div
								class="group relative cursor-pointer rounded-lg bg-gray-750 p-3 hover:bg-gray-700 transition-colors {draggedTaskId ===
								task.id
									? 'opacity-50'
									: ''} {dragOverTaskId === task.id
									? 'border-2 border-blue-500'
									: 'border border-gray-600'}"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, task)}
								ondragend={handleDragEnd}
								ondragover={(e) => handleDragOver(e, column.key, task.id)}
								onclick={() => onTaskClick?.(task)}
							>
								<!-- Drag handle -->
								<div
									class="absolute left-1 top-1 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 8h16M4 16h16"
										></path>
									</svg>
								</div>

								<!-- Task title -->
								<h4 class="mb-2 pl-5 text-sm font-medium">{task.title}</h4>

								<!-- Metadata row -->
								<div class="flex flex-wrap items-center gap-2 text-xs">
									<!-- Priority badge -->
									{#if task.priority}
										{@const badge = priorityBadge(task.priority)}
										{#if badge.text}
											<span class="rounded px-2 py-0.5 {badge.class}">
												{badge.text}
											</span>
										{/if}
									{/if}

									<!-- Due date -->
									{#if task.due_date}
										{@const dueDateText = formatDueDate(task.due_date)}
										<span class="text-gray-400">
											📅 {dueDateText}
										</span>
									{/if}

									<!-- Subtask count -->
									{#if subtaskCount(task.id) > 0}
										{@const subtasks = subtaskCount(task.id)}
										<span class="text-gray-400">
											📋 {subtasks}
										</span>
									{/if}

									<!-- Blocked indicator -->
									{#if isBlocked(task.id)}
										<span class="text-red-400" title="Blocked"> 🚫 </span>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	/* Custom gray-750 since it's not in default Tailwind */
	.bg-gray-750 {
		background-color: #2d3748;
	}
</style>
