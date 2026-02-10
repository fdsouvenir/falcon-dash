<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		createDomain,
		createFocus,
		createMilestone,
		domains,
		focuses,
		milestones,
		loadDomains,
		loadFocuses,
		loadMilestones,
		type Domain,
		type Focus,
		type Milestone
	} from '$lib/stores/pm-domains.js';
	import { createProject, createTask, type Project, type Task } from '$lib/stores/pm-projects.js';

	interface Props {
		entityType: 'domain' | 'focus' | 'milestone' | 'project' | 'task';
		parentId?: string | number;
		onClose: () => void;
		onCreated?: (entity: unknown) => void;
	}

	let { entityType, parentId, onClose, onCreated }: Props = $props();

	// State
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Domain fields
	let domainId = $state('');
	let domainName = $state('');
	let domainDescription = $state('');

	// Focus fields
	let focusId = $state('');
	let focusDomainId = $state('');
	let focusName = $state('');
	let focusDescription = $state('');

	// Milestone fields
	let milestoneName = $state('');
	let milestoneDueDate = $state('');
	let milestoneDescription = $state('');

	// Project fields
	let projectFocusId = $state('');
	let projectTitle = $state('');
	let projectDescription = $state('');
	let projectStatus = $state('todo');
	let projectPriority = $state('');
	let projectDueDate = $state('');
	let projectMilestoneId = $state('');

	// Task fields
	let taskTitle = $state('');
	let taskBody = $state('');
	let taskStatus = $state('todo');
	let taskPriority = $state('');
	let taskDueDate = $state('');
	let taskMilestoneId = $state('');

	// Store subscriptions
	let allDomains = $state<Domain[]>([]);
	let allFocuses = $state<Focus[]>([]);
	let allMilestones = $state<Milestone[]>([]);

	onMount(async () => {
		document.addEventListener('keydown', handleKeyDown);

		// Load data for dropdowns
		await loadDomains();
		await loadFocuses();
		await loadMilestones();

		allDomains = $domains;
		allFocuses = $focuses;
		allMilestones = $milestones;

		// Set defaults from parentId
		if (entityType === 'focus' && parentId) {
			focusDomainId = String(parentId);
		}
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeyDown);
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	async function handleSubmit() {
		error = null;
		loading = true;

		try {
			let entity: unknown;

			switch (entityType) {
				case 'domain':
					if (!domainId.trim() || !domainName.trim()) {
						error = 'ID and Name are required';
						loading = false;
						return;
					}
					entity = await createDomain({
						id: domainId,
						name: domainName,
						description: domainDescription || undefined
					});
					break;

				case 'focus':
					if (!focusId.trim() || !focusName.trim() || !focusDomainId) {
						error = 'ID, Name, and Domain are required';
						loading = false;
						return;
					}
					entity = await createFocus({
						id: focusId,
						domain_id: focusDomainId,
						name: focusName,
						description: focusDescription || undefined
					});
					break;

				case 'milestone':
					if (!milestoneName.trim()) {
						error = 'Name is required';
						loading = false;
						return;
					}
					entity = await createMilestone({
						name: milestoneName,
						due_date: milestoneDueDate || undefined,
						description: milestoneDescription || undefined
					});
					break;

				case 'project':
					if (!projectFocusId || !projectTitle.trim()) {
						error = 'Focus and Title are required';
						loading = false;
						return;
					}
					entity = await createProject({
						focus_id: projectFocusId,
						title: projectTitle,
						description: projectDescription || undefined,
						status: projectStatus || undefined,
						milestone_id: projectMilestoneId ? parseInt(projectMilestoneId) : undefined,
						due_date: projectDueDate || undefined,
						priority: projectPriority || undefined
					});
					break;

				case 'task':
					if (!taskTitle.trim()) {
						error = 'Title is required';
						loading = false;
						return;
					}

					const taskData: {
						title: string;
						body?: string;
						parent_project_id?: number;
						parent_task_id?: number;
						status?: string;
						due_date?: string;
						priority?: string;
						milestone_id?: number;
					} = {
						title: taskTitle,
						body: taskBody || undefined,
						status: taskStatus || undefined,
						due_date: taskDueDate || undefined,
						priority: taskPriority || undefined,
						milestone_id: taskMilestoneId ? parseInt(taskMilestoneId) : undefined
					};

					// Set parent from parentId
					if (parentId) {
						const numericParent = typeof parentId === 'string' ? parseInt(parentId) : parentId;
						// Assume parentId is a project ID by default, unless specified otherwise
						taskData.parent_project_id = numericParent;
					}

					entity = await createTask(taskData);
					break;
			}

			if (onCreated) {
				onCreated(entity);
			}
			onClose();
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function getTitle(): string {
		switch (entityType) {
			case 'domain':
				return 'Create Domain';
			case 'focus':
				return 'Create Focus';
			case 'milestone':
				return 'Create Milestone';
			case 'project':
				return 'Create Project';
			case 'task':
				return 'Create Task';
		}
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
	onclick={handleOverlayClick}
>
	<!-- Dialog -->
	<div
		class="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-700 p-4">
			<h2 class="text-lg font-semibold text-white">{getTitle()}</h2>
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

		<!-- Form -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="p-4 space-y-4"
		>
			{#if error}
				<div class="rounded bg-red-900/50 border border-red-700 px-3 py-2 text-sm text-red-200">
					{error}
				</div>
			{/if}

			{#if entityType === 'domain'}
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						ID (slug) <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={domainId}
						placeholder="e.g., engineering"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Name <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={domainName}
						placeholder="e.g., Engineering"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
					<textarea
						bind:value={domainDescription}
						rows="3"
						placeholder="Optional description"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					></textarea>
				</div>
			{/if}

			{#if entityType === 'focus'}
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						ID (slug) <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={focusId}
						placeholder="e.g., backend-api"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Domain <span class="text-red-400">*</span>
					</label>
					<select
						bind:value={focusDomainId}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
						required
					>
						<option value="">Select domain...</option>
						{#each allDomains as domain}
							<option value={domain.id}>{domain.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Name <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={focusName}
						placeholder="e.g., Backend API"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
					<textarea
						bind:value={focusDescription}
						rows="3"
						placeholder="Optional description"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					></textarea>
				</div>
			{/if}

			{#if entityType === 'milestone'}
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Name <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={milestoneName}
						placeholder="e.g., Q1 Launch"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
					<input
						type="date"
						bind:value={milestoneDueDate}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
					<textarea
						bind:value={milestoneDescription}
						rows="3"
						placeholder="Optional description"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					></textarea>
				</div>
			{/if}

			{#if entityType === 'project'}
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Focus <span class="text-red-400">*</span>
					</label>
					<select
						bind:value={projectFocusId}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
						required
					>
						<option value="">Select focus...</option>
						{#each allFocuses as focus}
							<option value={focus.id}>{focus.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Title <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={projectTitle}
						placeholder="Project title"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Description</label>
					<textarea
						bind:value={projectDescription}
						rows="3"
						placeholder="Optional description"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					></textarea>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Status</label>
					<select
						bind:value={projectStatus}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					>
						<option value="todo">Todo</option>
						<option value="in_progress">In Progress</option>
						<option value="review">Review</option>
						<option value="done">Done</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Priority</label>
					<select
						bind:value={projectPriority}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					>
						<option value="">None</option>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="critical">Critical</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
					<input
						type="date"
						bind:value={projectDueDate}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Milestone</label>
					<select
						bind:value={projectMilestoneId}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					>
						<option value="">None</option>
						{#each allMilestones as milestone}
							<option value={milestone.id.toString()}>{milestone.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if entityType === 'task'}
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">
						Title <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						bind:value={taskTitle}
						placeholder="Task title"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
						required
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Body</label>
					<textarea
						bind:value={taskBody}
						rows="4"
						placeholder="Optional task description"
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500"
					></textarea>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Status</label>
					<select
						bind:value={taskStatus}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					>
						<option value="todo">Todo</option>
						<option value="in_progress">In Progress</option>
						<option value="review">Review</option>
						<option value="done">Done</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Priority</label>
					<select
						bind:value={taskPriority}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					>
						<option value="">None</option>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="critical">Critical</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
					<input
						type="date"
						bind:value={taskDueDate}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-1">Milestone</label>
					<select
						bind:value={taskMilestoneId}
						class="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
					>
						<option value="">None</option>
						{#each allMilestones as milestone}
							<option value={milestone.id.toString()}>{milestone.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-2 pt-2">
				<button
					type="submit"
					disabled={loading}
					class="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Creating...' : 'Create'}
				</button>
				<button
					type="button"
					onclick={onClose}
					class="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
				>
					Cancel
				</button>
			</div>
		</form>
	</div>
</div>
