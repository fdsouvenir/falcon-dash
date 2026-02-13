<script lang="ts">
	import {
		getProject,
		updateProject,
		loadTasks,
		createTask,
		updateTask,
		type Project,
		type Task
	} from '$lib/stores/pm-projects.js';
	import {
		listComments,
		createComment,
		updateComment,
		deleteComment,
		listAttachments,
		createAttachment,
		deleteAttachment,
		listActivities,
		type Comment,
		type Attachment,
		type Activity,
		type Block
	} from '$lib/stores/pm-operations.js';
	import { getDomain, getFocus, type Domain, type Focus } from '$lib/stores/pm-domains.js';

	interface Props {
		projectId: number;
		onClose?: () => void;
		onTaskClick?: (taskId: number) => void;
	}

	let { projectId, onClose, onTaskClick }: Props = $props();

	let project = $state<Project | null>(null);
	let domain = $state<Domain | null>(null);
	let focus = $state<Focus | null>(null);
	let tasks = $state<Task[]>([]);
	let comments = $state<Comment[]>([]);
	let attachments = $state<Attachment[]>([]);
	let activities = $state<Activity[]>([]);
	let blocks = $state<{ blocking: Block[]; blockedBy: Block[] }>({
		blocking: [],
		blockedBy: []
	});

	let activeTab = $state<'tasks' | 'comments' | 'attachments' | 'activity' | 'blocks'>('tasks');
	let editingTitle = $state(false);
	let editingDescription = $state(false);
	let titleInput = $state('');
	let descriptionInput = $state('');
	let commentBody = $state('');
	let editingCommentId = $state<number | null>(null);
	let editingCommentBody = $state('');
	let addTaskTitle = $state('');
	let attachmentForm = $state({
		file_path: '',
		file_name: '',
		description: ''
	});
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function loadData() {
		loading = true;
		error = null;
		try {
			project = await getProject(projectId);
			if (project) {
				titleInput = project.title;
				descriptionInput = project.description || '';
				if (project.focus_id) {
					focus = await getFocus(project.focus_id);
					if (focus?.domain_id) {
						domain = await getDomain(focus.domain_id);
					}
				}
				await loadTasks({ parent_project_id: projectId });
				comments = await listComments('project', projectId);
				attachments = await listAttachments('project', projectId);
				activities = await listActivities(projectId, 20);
			}
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	async function loadTasksData() {
		try {
			await loadTasks({ parent_project_id: projectId });
			// loadTasks returns void but updates the store, we need to fetch manually
			// For now, we'll store tasks in local state
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleTitleSave() {
		if (!project || titleInput.trim() === '') return;
		try {
			project = await updateProject(project.id, { title: titleInput.trim() });
			editingTitle = false;
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleDescriptionSave() {
		if (!project) return;
		try {
			project = await updateProject(project.id, { description: descriptionInput.trim() });
			editingDescription = false;
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleStatusChange(newStatus: string) {
		if (!project) return;
		try {
			project = await updateProject(project.id, { status: newStatus });
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handlePriorityChange(newPriority: string) {
		if (!project) return;
		try {
			project = await updateProject(project.id, { priority: newPriority });
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleDueDateChange(e: Event) {
		if (!project) return;
		const target = e.target as HTMLInputElement;
		try {
			project = await updateProject(project.id, { due_date: target.value || undefined });
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleAddComment() {
		if (!project || commentBody.trim() === '') return;
		try {
			await createComment({
				target_type: 'project',
				target_id: project.id,
				body: commentBody.trim(),
				author: 'current-user'
			});
			commentBody = '';
			comments = await listComments('project', project.id);
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleEditComment(comment: Comment) {
		editingCommentId = comment.id;
		editingCommentBody = comment.body;
	}

	async function handleSaveComment() {
		if (editingCommentId === null || editingCommentBody.trim() === '') return;
		try {
			await updateComment(editingCommentId, editingCommentBody.trim());
			editingCommentId = null;
			editingCommentBody = '';
			if (project) {
				comments = await listComments('project', project.id);
			}
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleDeleteComment(commentId: number) {
		try {
			await deleteComment(commentId);
			if (project) {
				comments = await listComments('project', project.id);
			}
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleAddTask() {
		if (!project || addTaskTitle.trim() === '') return;
		try {
			await createTask({
				title: addTaskTitle.trim(),
				parent_project_id: project.id,
				status: 'todo'
			});
			addTaskTitle = '';
			await loadTasksData();
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleTaskStatusToggle(task: Task) {
		try {
			const newStatus = task.status === 'done' ? 'todo' : 'done';
			await updateTask(task.id, { status: newStatus });
			await loadTasksData();
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleAddAttachment() {
		if (
			!project ||
			attachmentForm.file_path.trim() === '' ||
			attachmentForm.file_name.trim() === ''
		)
			return;
		try {
			await createAttachment({
				target_type: 'project',
				target_id: project.id,
				file_path: attachmentForm.file_path.trim(),
				file_name: attachmentForm.file_name.trim(),
				description: attachmentForm.description.trim() || undefined,
				added_by: 'current-user'
			});
			attachmentForm = { file_path: '', file_name: '', description: '' };
			attachments = await listAttachments('project', project.id);
		} catch (err) {
			error = (err as Error).message;
		}
	}

	async function handleDeleteAttachment(attachmentId: number) {
		try {
			await deleteAttachment(attachmentId);
			if (project) {
				attachments = await listAttachments('project', project.id);
			}
		} catch (err) {
			error = (err as Error).message;
		}
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	function getPriorityColor(priority: string | null): string {
		if (!priority) return 'bg-gray-600';
		switch (priority.toLowerCase()) {
			case 'critical':
				return 'bg-red-600';
			case 'high':
				return 'bg-orange-600';
			case 'medium':
				return 'bg-yellow-600';
			case 'low':
				return 'bg-green-600';
			default:
				return 'bg-gray-600';
		}
	}

	function getStatusColor(status: string): string {
		switch (status.toLowerCase()) {
			case 'todo':
				return 'bg-gray-600';
			case 'in_progress':
				return 'bg-blue-600';
			case 'review':
				return 'bg-purple-600';
			case 'done':
				return 'bg-green-600';
			default:
				return 'bg-gray-600';
		}
	}

	function buildTaskTree(allTasks: Task[]): Task[] {
		const topLevel = allTasks.filter((t) => t.parent_task_id === null);
		return topLevel.sort((a, b) => a.sort_order - b.sort_order);
	}

	function getSubtasks(parentId: number, allTasks: Task[]): Task[] {
		const subs = allTasks.filter((t) => t.parent_task_id === parentId);
		return subs.sort((a, b) => a.sort_order - b.sort_order);
	}

	$effect(() => {
		loadData();
	});
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
	<div class="bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
		{#if loading}
			<div class="p-8 text-center text-gray-400">Loading...</div>
		{:else if error}
			<div class="p-8">
				<div class="text-red-500 mb-4">Error: {error}</div>
				<button onclick={onClose} class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">
					Close
				</button>
			</div>
		{:else if project}
			<!-- Header -->
			<div class="bg-gray-800 border-b border-gray-700 p-6">
				<!-- Breadcrumb -->
				<div class="text-sm text-gray-400 mb-3">
					{#if domain && focus}
						<span>{domain.name}</span>
						<span class="mx-2">›</span>
						<span>{focus.name}</span>
						<span class="mx-2">›</span>
						<span class="text-gray-300">{project.title}</span>
					{:else}
						<span class="text-gray-300">{project.title}</span>
					{/if}
				</div>

				<!-- Title -->
				<div class="mb-4">
					{#if editingTitle}
						<input
							type="text"
							bind:value={titleInput}
							onkeydown={(e) => {
								if (e.key === 'Enter') handleTitleSave();
								if (e.key === 'Escape') {
									editingTitle = false;
									titleInput = project?.title || '';
								}
							}}
							class="w-full bg-gray-700 text-white text-2xl font-bold px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
							autofocus
						/>
					{:else}
						<h1
							onclick={() => {
								editingTitle = true;
							}}
							class="text-2xl font-bold text-white cursor-pointer hover:text-gray-300"
						>
							{project.title}
						</h1>
					{/if}
				</div>

				<!-- Metadata row -->
				<div class="flex flex-wrap gap-4 items-center">
					<!-- Status -->
					<div>
						<label class="text-xs text-gray-400 block mb-1">Status</label>
						<select
							value={project.status}
							onchange={(e) => handleStatusChange((e.target as HTMLSelectElement).value)}
							class="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
						>
							<option value="todo">Todo</option>
							<option value="in_progress">In Progress</option>
							<option value="review">Review</option>
							<option value="done">Done</option>
						</select>
					</div>

					<!-- Priority -->
					<div>
						<label class="text-xs text-gray-400 block mb-1">Priority</label>
						<select
							value={project.priority || ''}
							onchange={(e) => handlePriorityChange((e.target as HTMLSelectElement).value)}
							class="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
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
						<label class="text-xs text-gray-400 block mb-1">Due Date</label>
						<input
							type="date"
							value={project.due_date || ''}
							onchange={handleDueDateChange}
							class="bg-gray-700 text-white px-3 py-1 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
						/>
					</div>

					<!-- Close button -->
					<div class="ml-auto">
						<button
							onclick={onClose}
							class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
						>
							Close
						</button>
					</div>
				</div>

				<!-- Description -->
				<div class="mt-4">
					{#if editingDescription}
						<textarea
							bind:value={descriptionInput}
							onkeydown={(e) => {
								if (e.key === 'Escape') {
									editingDescription = false;
									descriptionInput = project?.description || '';
								}
							}}
							class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
							rows="4"
							placeholder="Add a description..."
						></textarea>
						<div class="mt-2 flex gap-2">
							<button
								onclick={handleDescriptionSave}
								class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
							>
								Save
							</button>
							<button
								onclick={() => {
									editingDescription = false;
									descriptionInput = project?.description || '';
								}}
								class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
							>
								Cancel
							</button>
						</div>
					{:else}
						<div
							onclick={() => {
								editingDescription = true;
							}}
							class="text-gray-300 text-sm cursor-pointer hover:text-white"
						>
							{project.description || 'Add a description...'}
						</div>
					{/if}
				</div>
			</div>

			<!-- Tabs -->
			<div class="bg-gray-800 border-b border-gray-700">
				<div class="flex gap-1 px-6">
					<button
						onclick={() => {
							activeTab = 'tasks';
						}}
						class={`px-4 py-2 text-sm font-medium ${
							activeTab === 'tasks'
								? 'text-white border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Tasks
					</button>
					<button
						onclick={() => {
							activeTab = 'comments';
						}}
						class={`px-4 py-2 text-sm font-medium ${
							activeTab === 'comments'
								? 'text-white border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Comments ({comments.length})
					</button>
					<button
						onclick={() => {
							activeTab = 'attachments';
						}}
						class={`px-4 py-2 text-sm font-medium ${
							activeTab === 'attachments'
								? 'text-white border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Attachments ({attachments.length})
					</button>
					<button
						onclick={() => {
							activeTab = 'activity';
						}}
						class={`px-4 py-2 text-sm font-medium ${
							activeTab === 'activity'
								? 'text-white border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Activity
					</button>
					<button
						onclick={() => {
							activeTab = 'blocks';
						}}
						class={`px-4 py-2 text-sm font-medium ${
							activeTab === 'blocks'
								? 'text-white border-b-2 border-blue-500'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Blocks
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="overflow-y-auto max-h-[calc(90vh-300px)] p-6">
				{#if activeTab === 'tasks'}
					<div class="space-y-2">
						{#each buildTaskTree(tasks) as task (task.id)}
							<div class="bg-gray-800 rounded p-3">
								<div class="flex items-center gap-3">
									<input
										type="checkbox"
										checked={task.status === 'done'}
										onchange={() => handleTaskStatusToggle(task)}
										class="w-4 h-4 rounded"
									/>
									<button
										onclick={() => onTaskClick?.(task.id)}
										class="flex-1 text-left text-white hover:text-blue-400"
									>
										{task.title}
									</button>
									{#if task.priority}
										<span class={`text-xs px-2 py-1 rounded ${getPriorityColor(task.priority)}`}>
											{task.priority}
										</span>
									{/if}
									<span class={`text-xs px-2 py-1 rounded ${getStatusColor(task.status)}`}>
										{task.status}
									</span>
								</div>
								{#each getSubtasks(task.id, tasks) as subtask (subtask.id)}
									<div class="ml-8 mt-2 bg-gray-700 rounded p-2 flex items-center gap-3">
										<input
											type="checkbox"
											checked={subtask.status === 'done'}
											onchange={() => handleTaskStatusToggle(subtask)}
											class="w-4 h-4 rounded"
										/>
										<button
											onclick={() => onTaskClick?.(subtask.id)}
											class="flex-1 text-left text-white hover:text-blue-400 text-sm"
										>
											{subtask.title}
										</button>
										{#if subtask.priority}
											<span
												class={`text-xs px-2 py-1 rounded ${getPriorityColor(subtask.priority)}`}
											>
												{subtask.priority}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						{/each}

						<!-- Add task form -->
						<div class="bg-gray-800 rounded p-3 mt-4">
							<input
								type="text"
								bind:value={addTaskTitle}
								onkeydown={(e) => {
									if (e.key === 'Enter') handleAddTask();
								}}
								placeholder="Add a task..."
								class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
							/>
							<button
								onclick={handleAddTask}
								class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
							>
								Add Task
							</button>
						</div>
					</div>
				{:else if activeTab === 'comments'}
					<div class="space-y-4">
						{#each comments as comment (comment.id)}
							<div class="bg-gray-800 rounded p-4">
								<div class="flex justify-between items-start mb-2">
									<div>
										<span class="text-white font-medium">{comment.author}</span>
										<span class="text-gray-400 text-sm ml-2">
											{formatTimestamp(comment.created_at)}
										</span>
									</div>
									<div class="flex gap-2">
										<button
											onclick={() => handleEditComment(comment)}
											class="text-blue-400 hover:text-blue-300 text-sm"
										>
											Edit
										</button>
										<button
											onclick={() => handleDeleteComment(comment.id)}
											class="text-red-400 hover:text-red-300 text-sm"
										>
											Delete
										</button>
									</div>
								</div>
								{#if editingCommentId === comment.id}
									<textarea
										bind:value={editingCommentBody}
										class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
										rows="3"
									></textarea>
									<div class="mt-2 flex gap-2">
										<button
											onclick={handleSaveComment}
											class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
										>
											Save
										</button>
										<button
											onclick={() => {
												editingCommentId = null;
												editingCommentBody = '';
											}}
											class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
										>
											Cancel
										</button>
									</div>
								{:else}
									<p class="text-gray-300 text-sm">{comment.body}</p>
								{/if}
							</div>
						{/each}

						<!-- Add comment form -->
						<div class="bg-gray-800 rounded p-4">
							<textarea
								bind:value={commentBody}
								placeholder="Add a comment..."
								class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
								rows="3"
							></textarea>
							<button
								onclick={handleAddComment}
								class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
							>
								Add Comment
							</button>
						</div>
					</div>
				{:else if activeTab === 'attachments'}
					<div class="space-y-4">
						{#each attachments as attachment (attachment.id)}
							<div class="bg-gray-800 rounded p-4 flex justify-between items-start">
								<div>
									<div class="text-white font-medium">{attachment.file_name}</div>
									{#if attachment.description}
										<p class="text-gray-400 text-sm mt-1">{attachment.description}</p>
									{/if}
									<div class="text-gray-500 text-xs mt-2">
										Added by {attachment.added_by} on {formatTimestamp(attachment.created_at)}
									</div>
								</div>
								<button
									onclick={() => handleDeleteAttachment(attachment.id)}
									class="text-red-400 hover:text-red-300 text-sm"
								>
									Delete
								</button>
							</div>
						{/each}

						<!-- Add attachment form -->
						<div class="bg-gray-800 rounded p-4">
							<h3 class="text-white font-medium mb-3">Add Attachment</h3>
							<div class="space-y-2">
								<input
									type="text"
									bind:value={attachmentForm.file_path}
									placeholder="File path"
									class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
								/>
								<input
									type="text"
									bind:value={attachmentForm.file_name}
									placeholder="File name"
									class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
								/>
								<input
									type="text"
									bind:value={attachmentForm.description}
									placeholder="Description (optional)"
									class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
								/>
								<button
									onclick={handleAddAttachment}
									class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
								>
									Add Attachment
								</button>
							</div>
						</div>
					</div>
				{:else if activeTab === 'activity'}
					<div class="space-y-2">
						{#each activities as activity (activity.id)}
							<div class="bg-gray-800 rounded p-3">
								<div class="text-sm">
									<span class="text-white font-medium">{activity.actor}</span>
									<span class="text-gray-400 mx-2">{activity.action}</span>
									<span class="text-white">{activity.target_type}</span>
									{#if activity.target_title}
										<span class="text-gray-400 mx-2">"{activity.target_title}"</span>
									{/if}
								</div>
								<div class="text-gray-500 text-xs mt-1">
									{formatTimestamp(activity.created_at)}
								</div>
								{#if activity.details}
									<div class="text-gray-400 text-xs mt-1">{activity.details}</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else if activeTab === 'blocks'}
					<div class="space-y-6">
						<div>
							<h3 class="text-white font-medium mb-3">Blocking</h3>
							{#if blocks.blocking.length > 0}
								<div class="space-y-2">
									{#each blocks.blocking as block (block.blocker_id + '-' + block.blocked_id)}
										<div class="bg-gray-800 rounded p-3 text-gray-300 text-sm">
											Task #{block.blocker_id} blocks Task #{block.blocked_id}
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-gray-500 text-sm">No blocking relationships</p>
							{/if}
						</div>

						<div>
							<h3 class="text-white font-medium mb-3">Blocked By</h3>
							{#if blocks.blockedBy.length > 0}
								<div class="space-y-2">
									{#each blocks.blockedBy as block (block.blocker_id + '-' + block.blocked_id)}
										<div class="bg-gray-800 rounded p-3 text-gray-300 text-sm">
											Task #{block.blocked_id} is blocked by Task #{block.blocker_id}
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-gray-500 text-sm">Not blocked by any tasks</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
