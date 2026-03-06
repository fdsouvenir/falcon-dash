<script lang="ts">
	import ProjectList from '$lib/components/pm/ProjectList.svelte';
	import ProjectDetail from '$lib/components/pm/ProjectDetail.svelte';

	import { pmAvailable, checkPMAvailability, hydratePMStores } from '$lib/stores/pm-store.js';

	let selectedProjectId = $state<number | null>(null);
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

	// --- History state management ---
	interface PMNavState {
		projectId: number | null;
	}

	function navigateToProject(projectId: number) {
		selectedProjectId = projectId;
		history.pushState({ pmNav: { projectId } satisfies PMNavState }, '');
	}

	function navigateBack() {
		history.back();
	}

	$effect(() => {
		function handlePopState(e: PopStateEvent) {
			const nav = (e.state as { pmNav?: PMNavState } | null)?.pmNav;
			if (nav) {
				selectedProjectId = nav.projectId;
			} else {
				selectedProjectId = null;
			}
		}
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	});
</script>

<svelte:head>
	<title>Projects - Falcon Dash</title>
</svelte:head>

{#if !checked}
	<div
		class="flex h-full items-center justify-center bg-surface-0 text-[length:var(--text-body)] text-status-muted"
	>
		Loading...
	</div>
{:else if !available}
	<div class="flex h-full items-center justify-center bg-surface-0 text-white">
		<div class="rounded-lg border border-surface-border bg-surface-1 p-8 text-center">
			<h2 class="mb-2 text-[length:var(--text-page-title)] font-semibold">PM Not Available</h2>
			<p class="text-[length:var(--text-body)] text-status-muted">
				The project management database is not configured or not available.
			</p>
		</div>
	</div>
{:else}
	<div class="flex h-full overflow-hidden bg-surface-0 text-white">
		<div
			class="min-w-0 {selectedProjectId !== null
				? 'flex-[3]'
				: 'flex-1'} overflow-hidden transition-all duration-200"
		>
			<ProjectList onselect={navigateToProject} selectedId={selectedProjectId} />
		</div>

		{#if selectedProjectId !== null}
			<ProjectDetail projectId={selectedProjectId} onClose={navigateBack} />
		{/if}
	</div>
{/if}
