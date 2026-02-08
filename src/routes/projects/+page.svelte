<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		loadStats,
		loadActivities,
		loadProjects,
		loadBlocks,
		loadDomains,
		loadFocuses,
		initPmListeners,
		destroyPmListeners
	} from '$lib/stores';
	import {
		PmSidebar,
		PmDashboard,
		ProjectList,
		KanbanBoard,
		PmSearch,
		TaskDetail
	} from '$lib/components/pm';

	// --- Types ---

	type PmView = 'dashboard' | 'list' | 'kanban';

	// --- State ---

	let loading = true;
	let errorMessage = '';

	// View state — synced with URL ?view= param
	let currentView: PmView = 'dashboard';

	// Filter state — preserved across view switches
	let selectedDomainId: string | null = null;
	let selectedFocusId: string | null = null;

	// Task detail panel state
	let selectedTaskId: number | null = null;
	let taskDetailOpen = false;

	// Search visibility
	let showSearch = false;

	// PM sidebar collapsed on mobile
	let pmSidebarOpen = false;

	// --- URL sync ---

	function parseViewFromUrl(): PmView {
		const v = $page.url.searchParams.get('view');
		if (v === 'list' || v === 'kanban') return v;
		return 'dashboard';
	}

	function setView(view: PmView): void {
		currentView = view;
		const url = new URL($page.url);
		if (view === 'dashboard') {
			url.searchParams.delete('view');
		} else {
			url.searchParams.set('view', view);
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// --- Event handlers ---

	function handleSidebarSelect(
		e: CustomEvent<{ domainId: string | null; focusId: string | null }>
	): void {
		selectedDomainId = e.detail.domainId;
		selectedFocusId = e.detail.focusId;
	}

	function handleProjectSelect(e: CustomEvent<{ projectId: number }>): void {
		goto(`/projects/${e.detail.projectId}`);
	}

	function handleTaskSelect(e: CustomEvent<{ taskId: number }>): void {
		selectedTaskId = e.detail.taskId;
		taskDetailOpen = true;
	}

	function handleTaskDetailClose(): void {
		taskDetailOpen = false;
		selectedTaskId = null;
	}

	function handleTaskDetailNavigate(e: CustomEvent<{ taskId: number }>): void {
		selectedTaskId = e.detail.taskId;
	}

	function handleSearchSelect(e: CustomEvent<{ entityType: string; id: number | string }>): void {
		showSearch = false;
		if (e.detail.entityType === 'project') {
			goto(`/projects/${e.detail.id}`);
		} else if (e.detail.entityType === 'task') {
			selectedTaskId = Number(e.detail.id);
			taskDetailOpen = true;
		}
	}

	function toggleSearch(): void {
		showSearch = !showSearch;
	}

	function togglePmSidebar(): void {
		pmSidebarOpen = !pmSidebarOpen;
	}

	function isActiveView(view: PmView): boolean {
		return currentView === view;
	}

	// --- Lifecycle ---

	onMount(async () => {
		currentView = parseViewFromUrl();
		initPmListeners();
		try {
			await Promise.all([
				loadStats(),
				loadActivities(undefined, undefined, 20),
				loadProjects(),
				loadBlocks(),
				loadDomains(),
				loadFocuses()
			]);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load PM data';
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
			<p class="text-sm text-slate-400">Loading project management...</p>
		</div>
	{:else}
		<!-- Header with view switcher and search -->
		<div class="flex items-center justify-between border-b border-slate-700 px-4 py-3 sm:px-6">
			<div class="flex items-center space-x-3">
				<!-- Mobile PM sidebar toggle -->
				<button
					on:click={togglePmSidebar}
					class="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 lg:hidden"
					aria-label="Toggle sidebar"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>

				<h1 class="text-lg font-semibold text-slate-100">Projects</h1>

				<!-- View switcher tabs -->
				<div class="hidden items-center space-x-1 sm:flex">
					<button
						on:click={() => setView('dashboard')}
						class="rounded px-3 py-1.5 text-xs font-medium transition-colors {isActiveView(
							'dashboard'
						)
							? 'bg-slate-700 text-slate-100'
							: 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
					>
						Dashboard
					</button>
					<button
						on:click={() => setView('list')}
						class="rounded px-3 py-1.5 text-xs font-medium transition-colors {isActiveView('list')
							? 'bg-slate-700 text-slate-100'
							: 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
					>
						List
					</button>
					<button
						on:click={() => setView('kanban')}
						class="rounded px-3 py-1.5 text-xs font-medium transition-colors {isActiveView('kanban')
							? 'bg-slate-700 text-slate-100'
							: 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'}"
					>
						Kanban
					</button>
				</div>
			</div>

			<div class="flex items-center space-x-2">
				<!-- Search toggle -->
				<button
					on:click={toggleSearch}
					class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
					aria-label="Search"
					class:bg-slate-700={showSearch}
					class:text-slate-200={showSearch}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Mobile view switcher (below header on small screens) -->
		<div class="flex border-b border-slate-700 sm:hidden">
			<button
				on:click={() => setView('dashboard')}
				class="flex-1 py-2 text-center text-xs font-medium transition-colors {isActiveView(
					'dashboard'
				)
					? 'border-b-2 border-blue-500 text-blue-400'
					: 'text-slate-400'}"
			>
				Dashboard
			</button>
			<button
				on:click={() => setView('list')}
				class="flex-1 py-2 text-center text-xs font-medium transition-colors {isActiveView('list')
					? 'border-b-2 border-blue-500 text-blue-400'
					: 'text-slate-400'}"
			>
				List
			</button>
			<button
				on:click={() => setView('kanban')}
				class="flex-1 py-2 text-center text-xs font-medium transition-colors {isActiveView('kanban')
					? 'border-b-2 border-blue-500 text-blue-400'
					: 'text-slate-400'}"
			>
				Kanban
			</button>
		</div>

		{#if errorMessage}
			<div class="border-b border-red-800 bg-red-900/30 px-6 py-2">
				<p class="text-sm text-red-400">{errorMessage}</p>
			</div>
		{/if}

		<!-- Search panel (collapsible) -->
		{#if showSearch}
			<div class="border-b border-slate-700 bg-slate-800/50 px-4 py-3 sm:px-6">
				<PmSearch on:select={handleSearchSelect} />
			</div>
		{/if}

		<!-- Main content area with optional PM sidebar -->
		<div class="flex flex-1 overflow-hidden">
			<!-- PM sidebar: Domain/Focus tree -->
			<!-- Mobile overlay -->
			{#if pmSidebarOpen}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div
					class="fixed inset-0 z-30 bg-black/50 lg:hidden"
					on:click={() => (pmSidebarOpen = false)}
				></div>
			{/if}

			<div
				class="fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-800 transition-transform lg:static lg:z-auto lg:translate-x-0"
				class:translate-x-0={pmSidebarOpen}
				class:-translate-x-full={!pmSidebarOpen}
			>
				<PmSidebar {selectedDomainId} {selectedFocusId} on:select={handleSidebarSelect} />
			</div>

			<!-- View content -->
			<div class="flex-1 overflow-y-auto">
				{#if currentView === 'dashboard'}
					<div class="p-6">
						<PmDashboard />
					</div>
				{:else if currentView === 'list'}
					<div class="p-6">
						<ProjectList {selectedDomainId} {selectedFocusId} on:select={handleProjectSelect} />
					</div>
				{:else if currentView === 'kanban'}
					<div class="h-full">
						<KanbanBoard
							selectedProjectId={null}
							{selectedFocusId}
							{selectedDomainId}
							on:select={handleTaskSelect}
						/>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Task detail slide-over panel -->
{#if selectedTaskId != null}
	<TaskDetail
		taskId={selectedTaskId}
		open={taskDetailOpen}
		on:close={handleTaskDetailClose}
		on:navigate={handleTaskDetailNavigate}
	/>
{/if}
