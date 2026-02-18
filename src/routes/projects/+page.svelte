<script lang="ts">
	import ProjectList from '$lib/components/pm/ProjectList.svelte';
	import ProjectDetail from '$lib/components/pm/ProjectDetail.svelte';
	import TaskDetailPanel from '$lib/components/pm/TaskDetailPanel.svelte';

	import { pmAvailable, checkPMAvailability, hydratePMStores } from '$lib/stores/pm-store.js';

	let selectedProjectId = $state<number | null>(null);
	let selectedTaskId = $state<number | null>(null);
	let available = $derived($pmAvailable);
	let checked = $state(false);

	$effect(() => {
		checkPMAvailability().then(() => {
			checked = true;
			if ($pmAvailable) {
				hydratePMStores();
			}
		});
	});
</script>

<svelte:head>
	<title>Projects - Falcon Dash</title>
</svelte:head>

{#if !checked}
	<div class="flex h-full items-center justify-center bg-gray-900 text-base text-gray-400">
		Loading...
	</div>
{:else if !available}
	<div class="flex h-full items-center justify-center bg-gray-900 text-white">
		<div class="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center">
			<h2 class="mb-2 text-xl font-semibold">PM Not Available</h2>
			<p class="text-base text-gray-400">
				The project management database is not configured or not available.
			</p>
		</div>
	</div>
{:else}
	<div class="flex h-full overflow-hidden bg-gray-900 text-white">
		<div class="flex-1 overflow-hidden">
			<ProjectList
				onselect={(projectId) => {
					selectedProjectId = projectId;
					selectedTaskId = null;
				}}
			/>
		</div>

		{#if selectedProjectId !== null}
			<ProjectDetail
				projectId={selectedProjectId}
				onClose={() => {
					selectedProjectId = null;
				}}
				onTaskClick={(taskId) => {
					selectedTaskId = taskId;
				}}
			/>
		{/if}

		{#if selectedTaskId !== null}
			<TaskDetailPanel
				taskId={selectedTaskId}
				onClose={() => {
					selectedTaskId = null;
				}}
				onNavigate={(taskId) => {
					selectedTaskId = taskId;
				}}
			/>
		{/if}
	</div>
{/if}
