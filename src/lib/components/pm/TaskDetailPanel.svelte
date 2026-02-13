<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		getTask,
		getProject,
		updateTask,
		deleteTask,
		createTask,
		reorderTasks,
		loadTasks,
		type Task
	} from '$lib/stores/pm-projects.js';
	import {
		listComments,
		createComment,
		deleteComment,
		listAttachments,
		createAttachment,
		deleteAttachment,
		listBlocks,
		createBlock,
		deleteBlock,
		type Comment,
		type Attachment,
		type Block
	} from '$lib/stores/pm-operations.js';
	import { loadMilestones, milestones, type Milestone } from '$lib/stores/pm-domains.js';

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
	let attachments = $state<Attachment[]>([]);
	let blocking = $state<Block[]>([]);
	let blockedBy = $state<Block[]>([]);
	let allMilestones = $state<Milestone[]>([]);

	// Edit states
	let editingTitle = $state(false);
	let editingBody = $state(false);
	let editTitleValue = $state('');
	let editBodyValue = $state('');

	// Form states
	let newSubtaskTitle = $state('');
	let newCommentBody = $state('');
	let newAttachmentPath = $state('');
	let newAttachmentName = $state('');
	let newAttachmentDesc = $state('');
	let newBlockerId = $state('');
	let newBlockedId = $state('');

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteMode = $state<'cascade' | 'promote'>('cascade');

	// Drag state
	let draggedTaskId = $state<number | null>(null);

	onMount(async () => {
		await loadData();
		document.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeyDown);
	});

	async function loadData() {
		task = await getTask(taskId);
		await buildAncestry();
		await loadSubtasks();
		comments = await listComments('task', taskId);
		attachments = await listAttachments('task', taskId);
		const blocks = await listBlocks(taskId);
		blocking = blocks.blocking;
		blockedBy = blocks.blockedBy;
		await loadMilestones();
		allMilestones = $milestones;
	}

	async function buildAncestry() {
		if (!task) return;
		const chain: Array<{ id: number; title: string; type: 'project' | 'task' }> = [];

		// Walk up parent task chain
		let currentTaskId = task.parent_task_id;
		while (currentTaskId) {
			const parentTask = await getTask(currentTaskId);
			chain.unshift({ id: parentTask.id, title: parentTask.title, type: 'task' });
			currentTaskId = parentTask.parent_task_id;
		}

		// Add project at root
		if (task.parent_project_id) {
			const project = await getProject(task.parent_project_id);
			chain.unshift({ id: project.id, title: project.title, type: 'project' });
		}

		ancestry = chain;
	}

	async function loadSubtasks() {
		if (!task) return;
		await loadTasks({ parent_task_id: task.id });
		// loadTasks returns void, need to call it differently
		// Use the tasks that are loaded into the store
		// For now, we'll fetch them separately
		const response = await import('$lib/stores/gateway.js');
		const result = await response.call<{ tasks: Task[] }>('pm.task.list', {
			parent_task_id: task.id
		});
		subtasks = result.tasks.sort((a, b) => a.sort_order - b.sort_order);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function startEditTitle() {
		if (!task) return;
		editTitleValue = task.title;
		editingTitle = true;
	}

	async function saveTitle() {
		if (!task || !editTitleValue.trim()) return;
		await updateTask(task.id, { title: editTitleValue });
		task.title = editTitleValue;
		editingTitle = false;
	}

	function cancelEditTitle() {
		editingTitle = false;
	}

	function startEditBody() {
		if (!task) return;
		editBodyValue = task.body || '';
		editingBody = true;
	}

	async function saveBody() {
		if (!task) return;
		await updateTask(task.id, { body: editBodyValue });
		task.body = editBodyValue;
		editingBody = false;
	}

	function cancelEditBody() {
		editingBody = false;
	}

	async function updateField(field: string, value: string | number | null) {
		if (!task) return;
		const data: Record<string, string | number | null> = {};
		data[field] = value;
		await updateTask(task.id, data);
		(task as unknown as Record<string, unknown>)[field] = value;
	}

	async function addSubtask() {
		if (!task || !newSubtaskTitle.trim()) return;
		await createTask({
			title: newSubtaskTitle,
			parent_project_id: task.parent_project_id || undefined,
			parent_task_id: task.id,
			status: 'todo'
		});
		newSubtaskTitle = '';
		await loadSubtasks();
	}

	function handleDragStart(e: DragEvent, subtaskId: number) {
		draggedTaskId = subtaskId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	async function handleDrop(e: DragEvent, targetId: number) {
		e.preventDefault();
		if (!draggedTaskId || draggedTaskId === targetId) return;

		const draggedIndex = subtasks.findIndex((t) => t.id === draggedTaskId);
		const targetIndex = subtasks.findIndex((t) => t.id === targetId);
		if (draggedIndex === -1 || targetIndex === -1) return;

		const newOrder = [...subtasks];
		const [removed] = newOrder.splice(draggedIndex, 1);
		newOrder.splice(targetIndex, 0, removed);

		subtasks = newOrder;
		await reorderTasks(newOrder.map((t) => t.id));
		draggedTaskId = null;
	}

	async function addComment() {
		if (!task || !newCommentBody.trim()) return;
		await createComment({
			target_type: 'task',
			target_id: task.id,
			body: newCommentBody,
			author: 'current-user'
		});
		newCommentBody = '';
		comments = await listComments('task', task.id);
	}

	async function removeComment(commentId: number) {
		if (!task) return;
		await deleteComment(commentId);
		comments = await listComments('task', task.id);
	}

	async function addAttachment() {
		if (!task || !newAttachmentPath.trim() || !newAttachmentName.trim()) return;
		await createAttachment({
			target_type: 'task',
			target_id: task.id,
			file_path: newAttachmentPath,
			file_name: newAttachmentName,
			description: newAttachmentDesc || undefined,
			added_by: 'current-user'
		});
		newAttachmentPath = '';
		newAttachmentName = '';
		newAttachmentDesc = '';
		attachments = await listAttachments('task', task.id);
	}

	async function removeAttachment(attachmentId: number) {
		if (!task) return;
		await deleteAttachment(attachmentId);
		attachments = await listAttachments('task', task.id);
	}

	async function addBlockingRelation() {
		if (!task || !newBlockerId.trim()) return;
		const blockerId = parseInt(newBlockerId);
		if (isNaN(blockerId)) return;
		await createBlock(blockerId, task.id);
		newBlockerId = '';
		const blocks = await listBlocks(task.id);
		blocking = blocks.blocking;
		blockedBy = blocks.blockedBy;
	}

	async function addBlockedRelation() {
		if (!task || !newBlockedId.trim()) return;
		const blockedId = parseInt(newBlockedId);
		if (isNaN(blockedId)) return;
		await createBlock(task.id, blockedId);
		newBlockedId = '';
		const blocks = await listBlocks(task.id);
		blocking = blocks.blocking;
		blockedBy = blocks.blockedBy;
	}

	async function removeBlockingRelation(blockerId: number) {
		if (!task) return;
		await deleteBlock(blockerId, task.id);
		const blocks = await listBlocks(task.id);
		blocking = blocks.blocking;
		blockedBy = blocks.blockedBy;
	}

	async function removeBlockedRelation(blockedId: number) {
		if (!task) return;
		await deleteBlock(task.id, blockedId);
		const blocks = await listBlocks(task.id);
		blocking = blocks.blocking;
		blockedBy = blocks.blockedBy;
	}

	async function confirmDelete() {
		if (!task) return;
		// TODO: implement cascade/promote logic when gateway supports it
		await deleteTask(task.id);
		onClose();
	}

	function handleBreadcrumbClick(item: { id: number; type: 'project' | 'task' }) {
		if (item.type === 'task' && onNavigate) {
			onNavigate(item.id);
		}
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40 bg-black/50" onclick={onClose}></div>

<!-- Panel -->
<div class="fixed inset-y-0 right-0 z-50 w-[500px] bg-gray-900 shadow-xl overflow-y-auto">
	{#if task}
		<!-- Header -->
		<div
			class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-900 p-4"
		>
			<h2 class="text-lg font-semibold text-white">Task Details</h2>
			<button
				onclick={onClose}
				class="rounded p-1 hover:bg-gray-800 text-gray-400 hover:text-white"
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

		<div class="p-4 space-y-6">
			<!-- Ancestry breadcrumb -->
			{#if ancestry.length > 0}
				<div class="flex items-center gap-2 text-sm text-gray-400">
					{#each ancestry as item, i (item.id)}
						{#if i > 0}
							<span>/</span>
						{/if}
						<button
							onclick={() => handleBreadcrumbClick(item)}
							class="hover:text-white hover:underline"
						>
							{item.title}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Title -->
			<div>
				{#if editingTitle}
					<div class="space-y-2">
						<input
							type="text"
							bind:value={editTitleValue}
							class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
						/>
						<div class="flex gap-2">
							<button
								onclick={saveTitle}
								class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
								>Save</button
							>
							<button
								onclick={cancelEditTitle}
								class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
								>Cancel</button
							>
						</div>
					</div>
				{:else}
					<h2
						onclick={startEditTitle}
						class="cursor-pointer text-xl font-semibold text-white hover:text-blue-400"
					>
						{task.title}
					</h2>
				{/if}
			</div>

			<!-- Body -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
				{#if editingBody}
					<div class="space-y-2">
						<textarea
							bind:value={editBodyValue}
							rows="6"
							class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
						></textarea>
						<div class="flex gap-2">
							<button
								onclick={saveBody}
								class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
								>Save</button
							>
							<button
								onclick={cancelEditBody}
								class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
								>Cancel</button
							>
						</div>
					</div>
				{:else}
					<div
						onclick={startEditBody}
						class="cursor-pointer rounded border border-gray-700 bg-gray-800 p-3 text-gray-300 hover:border-blue-500 min-h-[80px]"
					>
						{task.body || 'Click to add description...'}
					</div>
				{/if}
			</div>

			<!-- Status -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Status</label>
				<select
					value={task.status}
					onchange={(e) => updateField('status', e.currentTarget.value)}
					class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
				>
					<option value="todo">Todo</option>
					<option value="in_progress">In Progress</option>
					<option value="review">Review</option>
					<option value="done">Done</option>
				</select>
			</div>

			<!-- Priority -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Priority</label>
				<select
					value={task.priority || ''}
					onchange={(e) => updateField('priority', e.currentTarget.value || null)}
					class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
				>
					<option value="">None</option>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
					<option value="critical">Critical</option>
				</select>
			</div>

			<!-- Due date -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
				<input
					type="date"
					value={task.due_date || ''}
					onchange={(e) => updateField('due_date', e.currentTarget.value || null)}
					class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
				/>
			</div>

			<!-- Milestone -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Milestone</label>
				<select
					value={task.milestone_id || ''}
					onchange={(e) =>
						updateField(
							'milestone_id',
							e.currentTarget.value ? parseInt(e.currentTarget.value) : null
						)}
					class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
				>
					<option value="">None</option>
					{#each allMilestones as milestone (milestone.id)}
						<option value={milestone.id}>{milestone.name}</option>
					{/each}
				</select>
			</div>

			<!-- Subtasks -->
			<div>
				<h3 class="text-lg font-semibold text-white mb-2">Subtasks</h3>
				<div class="space-y-2">
					{#each subtasks as subtask (subtask.id)}
						<div
							draggable="true"
							ondragstart={(e) => handleDragStart(e, subtask.id)}
							ondragover={handleDragOver}
							ondrop={(e) => handleDrop(e, subtask.id)}
							class="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 p-2 cursor-move hover:border-gray-600"
						>
							<input type="checkbox" checked={subtask.status === 'done'} class="h-4 w-4" disabled />
							<span class="flex-1 text-white">{subtask.title}</span>
							<span class="text-xs text-gray-400">{subtask.status}</span>
						</div>
					{/each}
				</div>
				<div class="mt-2 flex gap-2">
					<input
						type="text"
						bind:value={newSubtaskTitle}
						placeholder="New subtask title"
						class="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					/>
					<button
						onclick={addSubtask}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Add</button
					>
				</div>
			</div>

			<!-- Comments -->
			<div>
				<h3 class="text-lg font-semibold text-white mb-2">Comments</h3>
				<div class="space-y-3">
					{#each comments as comment (comment.id)}
						<div class="rounded border border-gray-700 bg-gray-800 p-3">
							<div class="flex items-start justify-between mb-1">
								<span class="text-sm font-medium text-gray-300">{comment.author}</span>
								<button
									onclick={() => removeComment(comment.id)}
									class="text-xs text-red-400 hover:text-red-300">Delete</button
								>
							</div>
							<p class="text-sm text-gray-400">{formatTimestamp(comment.created_at)}</p>
							<p class="mt-2 text-white">{comment.body}</p>
						</div>
					{/each}
				</div>
				<div class="mt-2 space-y-2">
					<textarea
						bind:value={newCommentBody}
						placeholder="Add a comment..."
						rows="3"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					></textarea>
					<button
						onclick={addComment}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Add Comment</button
					>
				</div>
			</div>

			<!-- Attachments -->
			<div>
				<h3 class="text-lg font-semibold text-white mb-2">Attachments</h3>
				<div class="space-y-2">
					{#each attachments as attachment (attachment.id)}
						<div
							class="flex items-center justify-between rounded border border-gray-700 bg-gray-800 p-2"
						>
							<div class="flex-1">
								<p class="text-white">{attachment.file_name}</p>
								{#if attachment.description}
									<p class="text-sm text-gray-400">{attachment.description}</p>
								{/if}
							</div>
							<button
								onclick={() => removeAttachment(attachment.id)}
								class="text-sm text-red-400 hover:text-red-300">Remove</button
							>
						</div>
					{/each}
				</div>
				<div class="mt-2 space-y-2">
					<input
						type="text"
						bind:value={newAttachmentPath}
						placeholder="File path"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					/>
					<input
						type="text"
						bind:value={newAttachmentName}
						placeholder="File name"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					/>
					<input
						type="text"
						bind:value={newAttachmentDesc}
						placeholder="Description (optional)"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					/>
					<button
						onclick={addAttachment}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
						>Add Attachment</button
					>
				</div>
			</div>

			<!-- Blocks -->
			<div>
				<h3 class="text-lg font-semibold text-white mb-2">Blocking/Blocked By</h3>

				<!-- Blocked By -->
				<div class="mb-4">
					<h4 class="text-sm font-medium text-gray-300 mb-1">Blocked By</h4>
					<div class="space-y-1">
						{#each blockedBy as block (block.blocker_id)}
							<div
								class="flex items-center justify-between rounded border border-gray-700 bg-gray-800 p-2"
							>
								<span class="text-white">Task #{block.blocker_id}</span>
								<button
									onclick={() => removeBlockingRelation(block.blocker_id)}
									class="text-sm text-red-400 hover:text-red-300">Remove</button
								>
							</div>
						{/each}
					</div>
					<div class="mt-2 flex gap-2">
						<input
							type="text"
							bind:value={newBlockerId}
							placeholder="Blocker task ID"
							class="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						/>
						<button
							onclick={addBlockingRelation}
							class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Add</button
						>
					</div>
				</div>

				<!-- Blocks -->
				<div>
					<h4 class="text-sm font-medium text-gray-300 mb-1">Blocks</h4>
					<div class="space-y-1">
						{#each blocking as block (block.blocked_id)}
							<div
								class="flex items-center justify-between rounded border border-gray-700 bg-gray-800 p-2"
							>
								<span class="text-white">Task #{block.blocked_id}</span>
								<button
									onclick={() => removeBlockedRelation(block.blocked_id)}
									class="text-sm text-red-400 hover:text-red-300">Remove</button
								>
							</div>
						{/each}
					</div>
					<div class="mt-2 flex gap-2">
						<input
							type="text"
							bind:value={newBlockedId}
							placeholder="Blocked task ID"
							class="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						/>
						<button
							onclick={addBlockedRelation}
							class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Add</button
						>
					</div>
				</div>
			</div>

			<!-- Delete -->
			<div class="border-t border-gray-700 pt-4">
				{#if showDeleteConfirm}
					<div class="space-y-3">
						<p class="text-white">Delete this task?</p>
						<div class="space-y-2">
							<label class="flex items-center gap-2 text-gray-300">
								<input type="radio" bind:group={deleteMode} value="cascade" />
								Delete and cascade subtasks
							</label>
							<label class="flex items-center gap-2 text-gray-300">
								<input type="radio" bind:group={deleteMode} value="promote" />
								Delete and promote subtasks to parent
							</label>
						</div>
						<div class="flex gap-2">
							<button
								onclick={confirmDelete}
								class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
								>Confirm Delete</button
							>
							<button
								onclick={() => (showDeleteConfirm = false)}
								class="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600">Cancel</button
							>
						</div>
					</div>
				{:else}
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
						>Delete Task</button
					>
				{/if}
			</div>
		</div>
	{/if}
</div>
