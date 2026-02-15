<script lang="ts">
	import { onDestroy } from 'svelte';
	import PMDashboard from '$lib/components/pm/PMDashboard.svelte';
	import PMNavTree from '$lib/components/pm/PMNavTree.svelte';
	import ProjectList from '$lib/components/pm/ProjectList.svelte';
	import ProjectDetail from '$lib/components/pm/ProjectDetail.svelte';
	import TaskDetailPanel from '$lib/components/pm/TaskDetailPanel.svelte';

	import { pmAvailable, hydratePMStores } from '$lib/stores/pm-store.js';
	import { subscribeToPMEvents } from '$lib/stores/pm-events.js';

	type NavSelection =
		| { type: 'dashboard' }
		| { type: 'all-projects' }
		| { type: 'domain'; domainId: string }
		| { type: 'focus'; domainId: string; focusId: string };

	// Page state
	let navSelection = $state<NavSelection>({ type: 'all-projects' });
	let projectFilter = $state<number | null>(null);
	let selectedProjectId = $state<number | null>(null);
	let selectedTaskId = $state<number | null>(null);

	// PM availability — reactively derived from gateway snapshot features
	let available = $derived($pmAvailable);
	let hydrated = $state(false);
	let eventUnsubscribe: (() => void) | null = null;

	// Reset hydration flag when PM becomes unavailable (disconnect/reconnect cycle)
	$effect(() => {
		if (!available) {
			hydrated = false;
			if (eventUnsubscribe) {
				eventUnsubscribe();
				eventUnsubscribe = null;
			}
		}
	});

	// React to PM becoming available (e.g. after hello-ok arrives with features)
	$effect(() => {
		if (available && !hydrated) {
			hydrated = true;
			hydratePMStores().catch((err) => {
				console.error('Failed to hydrate PM stores:', err);
			});
			eventUnsubscribe = subscribeToPMEvents();
		}
	});

	onDestroy(() => {
		if (eventUnsubscribe) eventUnsubscribe();
	});

	// Navigation handlers
	function handleNavTreeSelect(sel: NavSelection) {
		navSelection = sel;
		projectFilter = null;
		selectedProjectId = null;
		selectedTaskId = null;
	}

	function handleDashboardProjectClick(projectId: number) {
		navSelection = { type: 'all-projects' };
		projectFilter = projectId;
		selectedProjectId = null;
		selectedTaskId = null;
	}

	function handleProjectSelect(projectId: number) {
		selectedProjectId = projectId;
		selectedTaskId = null;
	}

	function handleTaskClick(taskId: number) {
		selectedTaskId = taskId;
	}

	function handleTaskNavigate(taskId: number) {
		selectedTaskId = taskId;
	}

	function closeProjectDetail() {
		selectedProjectId = null;
	}

	function closeTaskDetailPanel() {
		selectedTaskId = null;
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
	<div class="flex h-full overflow-hidden bg-gray-900 text-white">
		<!-- Left sidebar: PMNavTree -->
		<PMNavTree selection={navSelection} onselect={handleNavTreeSelect} />

		<!-- Content area -->
		<div class="flex-1 overflow-hidden">
			{#if navSelection.type === 'dashboard'}
				<PMDashboard onProjectClick={handleDashboardProjectClick} />
			{:else}
				<ProjectList
					{navSelection}
					{projectFilter}
					onProjectClick={handleProjectSelect}
					onTaskClick={handleTaskClick}
				/>
			{/if}
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
	</div>
{/if}
