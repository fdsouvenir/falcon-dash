<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PMDashboard from '$lib/components/pm/PMDashboard.svelte';
	import PMNavTree from '$lib/components/pm/PMNavTree.svelte';
	import PMSearch from '$lib/components/pm/PMSearch.svelte';
	import ProjectList from '$lib/components/pm/ProjectList.svelte';
	import ProjectDetail from '$lib/components/pm/ProjectDetail.svelte';
	import KanbanBoard from '$lib/components/pm/KanbanBoard.svelte';
	import TaskDetailPanel from '$lib/components/pm/TaskDetailPanel.svelte';
	import CreateEntityDialog from '$lib/components/pm/CreateEntityDialog.svelte';
	import BulkActions from '$lib/components/pm/BulkActions.svelte';
	import AIContextPanel from '$lib/components/pm/AIContextPanel.svelte';
	import DependencyGraph from '$lib/components/pm/DependencyGraph.svelte';

	import { pmAvailable, hydratePMStores } from '$lib/stores/pm-store.js';
	import { subscribeToPMEvents } from '$lib/stores/pm-events.js';
	import { tasks, type Task } from '$lib/stores/pm-projects.js';
	import type { PMSearchResult } from '$lib/stores/pm-operations.js';

	// Page state
	let activeTab = $state<'dashboard' | 'kanban' | 'list'>('dashboard');
	let selectedDomainId = $state<string | null>(null);
	let selectedFocusId = $state<string | null>(null);
	let selectedProjectId = $state<number | null>(null);
	let selectedTaskId = $state<number | null>(null);
	let showCreateDialog = $state(false);
	let createDialogType = $state<'domain' | 'focus' | 'milestone' | 'project' | 'task'>('project');
	let createDialogParentId = $state<string | number | undefined>(undefined);
	let showAIContext = $state(false);
	let showDependencyGraph = $state(false);
	let bulkSelectedIds = $state<number[]>([]);

	// Task list for kanban/bulk
	let taskList = $state<Task[]>([]);
	let blocksData = $state<Array<{ blocker_id: number; blocked_id: number }>>([]);

	// Check PM availability
	let available = $state(false);
	let eventUnsubscribe: (() => void) | null = null;
	let tasksUnsubscribe: (() => void) | null = null;

	onMount(async () => {
		available = $pmAvailable;
		if (!available) return;

		try {
			await hydratePMStores();
			eventUnsubscribe = subscribeToPMEvents();
		} catch (err) {
			console.error('Failed to hydrate PM stores:', err);
		}

		// Subscribe to tasks store for kanban/bulk
		tasksUnsubscribe = tasks.subscribe((v) => {
			taskList = v;
		});
	});

	onDestroy(() => {
		if (eventUnsubscribe) eventUnsubscribe();
		if (tasksUnsubscribe) tasksUnsubscribe();
	});

	// Navigation handlers
	function handleNavTreeSelect(domainId: string | null, focusId: string | null) {
		selectedDomainId = domainId;
		selectedFocusId = focusId;
		selectedProjectId = null;
		selectedTaskId = null;
	}

	function handleProjectSelect(projectId: number) {
		selectedProjectId = projectId;
		selectedTaskId = null;
	}

	function handleTaskClick(task: Task) {
		selectedTaskId = task.id;
	}

	function handleTaskNavigate(taskId: number) {
		selectedTaskId = taskId;
	}

	function handleSearchResultClick(result: PMSearchResult) {
		if (result.entity_type === 'project') {
			selectedProjectId = result.entity_id;
			selectedTaskId = null;
		} else if (result.entity_type === 'task') {
			selectedTaskId = result.entity_id;
		}
	}

	// Dialog handlers
	function openCreateDialog(entityType: 'domain' | 'focus' | 'milestone' | 'project' | 'task') {
		createDialogType = entityType;
		createDialogParentId = undefined;
		showCreateDialog = true;
	}

	function closeCreateDialog() {
		showCreateDialog = false;
	}

	function closeProjectDetail() {
		selectedProjectId = null;
	}

	function closeTaskDetailPanel() {
		selectedTaskId = null;
	}

	// Refresh handler for bulk actions
	async function refreshData() {
		await hydratePMStores();
	}
</script>

<svelte:head>
	<title>Projects - Falcon Dash</title>
</svelte:head>

{#if !available}
	<div class="flex h-full items-center justify-center bg-gray-900 text-white">
		<div class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
			<h2 class="mb-2 text-xl font-semibold">PM Plugin Not Available</h2>
			<p class="text-gray-400">
				The project management plugin is not installed or not enabled on the gateway.
			</p>
		</div>
	</div>
{:else}
	<div class="flex h-full flex-col bg-gray-900 text-white">
		<!-- Top bar: Search -->
		<div class="border-b border-gray-800 p-4">
			<PMSearch onResultClick={handleSearchResultClick} />
		</div>

		<!-- Main content area -->
		<div class="flex flex-1 overflow-hidden">
			<!-- Left sidebar: PMNavTree -->
			<PMNavTree
				selectedDomain={selectedDomainId}
				selectedFocus={selectedFocusId}
				onselect={handleNavTreeSelect}
			/>

			<!-- Right content area -->
			<div class="flex flex-1 flex-col overflow-hidden">
				<!-- Tab bar -->
				<div class="flex items-center gap-1 border-b border-gray-800 px-6">
					<button
						onclick={() => {
							activeTab = 'dashboard';
						}}
						class={`px-4 py-3 text-sm font-medium ${
							activeTab === 'dashboard'
								? 'border-b-2 border-blue-500 text-white'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Dashboard
					</button>
					<button
						onclick={() => {
							activeTab = 'kanban';
						}}
						class={`px-4 py-3 text-sm font-medium ${
							activeTab === 'kanban'
								? 'border-b-2 border-blue-500 text-white'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						Kanban
					</button>
					<button
						onclick={() => {
							activeTab = 'list';
						}}
						class={`px-4 py-3 text-sm font-medium ${
							activeTab === 'list'
								? 'border-b-2 border-blue-500 text-white'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						List
					</button>

					<!-- Action buttons -->
					<div class="ml-auto flex items-center gap-2">
						<button
							onclick={() => {
								showAIContext = !showAIContext;
							}}
							class="rounded bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700"
							class:bg-blue-600={showAIContext}
							class:hover:bg-blue-700={showAIContext}
						>
							AI Context
						</button>
						<button
							onclick={() => openCreateDialog('project')}
							class="rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-700"
						>
							+ New Project
						</button>
					</div>
				</div>

				<!-- Tab content -->
				<div class="flex-1 overflow-hidden">
					{#if activeTab === 'dashboard'}
						<PMDashboard />
					{:else if activeTab === 'kanban'}
						<KanbanBoard tasks={taskList} onTaskClick={handleTaskClick} />
					{:else if activeTab === 'list'}
						<ProjectList
							domainFilter={selectedDomainId}
							focusFilter={selectedFocusId}
							onselect={handleProjectSelect}
						/>
					{/if}
				</div>
			</div>
		</div>

		<!-- Overlays -->

		<!-- ProjectDetail modal -->
		{#if selectedProjectId !== null}
			<ProjectDetail
				projectId={selectedProjectId}
				onClose={closeProjectDetail}
				onTaskClick={(taskId) => {
					selectedTaskId = taskId;
				}}
			/>
		{/if}

		<!-- TaskDetailPanel slide-in -->
		{#if selectedTaskId !== null}
			<TaskDetailPanel
				taskId={selectedTaskId}
				onClose={closeTaskDetailPanel}
				onNavigate={handleTaskNavigate}
			/>
		{/if}

		<!-- CreateEntityDialog modal -->
		{#if showCreateDialog}
			<CreateEntityDialog
				entityType={createDialogType}
				parentId={createDialogParentId}
				onClose={closeCreateDialog}
				onCreated={(entity) => {
					console.log('Created entity:', entity);
					refreshData();
				}}
			/>
		{/if}

		<!-- AIContextPanel slide-in (right side, below task detail) -->
		{#if showAIContext}
			<div class="fixed inset-y-0 right-0 z-40 w-[600px] bg-gray-900 shadow-xl">
				<div class="flex h-full flex-col">
					<div class="flex items-center justify-between border-b border-gray-700 p-4">
						<h2 class="text-lg font-semibold">AI Context</h2>
						<button
							onclick={() => {
								showAIContext = false;
							}}
							class="rounded p-1 hover:bg-gray-800"
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
					<div class="flex-1 overflow-auto">
						<AIContextPanel projectId={selectedProjectId ?? undefined} />
					</div>
				</div>
			</div>
		{/if}

		<!-- DependencyGraph modal -->
		{#if showDependencyGraph}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div class="h-[90vh] w-[90vw] rounded-lg bg-gray-900 shadow-xl">
					<div class="flex items-center justify-between border-b border-gray-700 p-4">
						<h2 class="text-lg font-semibold">Dependency Graph</h2>
						<button
							onclick={() => {
								showDependencyGraph = false;
							}}
							class="rounded p-1 hover:bg-gray-800"
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
					<div class="h-[calc(100%-4rem)] overflow-auto p-4">
						<DependencyGraph
							tasks={taskList}
							blocks={blocksData}
							onTaskClick={(taskId) => {
								selectedTaskId = taskId;
							}}
						/>
					</div>
				</div>
			</div>
		{/if}

		<!-- BulkActions toolbar (bottom, only visible when tasks selected) -->
		{#if bulkSelectedIds.length > 0}
			<div class="border-t border-gray-800 p-4">
				<BulkActions tasks={taskList} onRefresh={refreshData} />
			</div>
		{/if}
	</div>
{/if}
