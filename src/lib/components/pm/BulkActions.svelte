<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { PmStatus } from '$lib/types';
	import { pmProjects, pmMilestones, bulkUpdateTasks, bulkMoveTasks } from '$lib/stores';
	import ConfirmDialog from '$lib/components/files/ConfirmDialog.svelte';

	interface Props {
		/** Set of selected task IDs */
		selectedIds: Set<number>;
		/** Total number of selectable tasks (for select all toggle) */
		totalCount?: number;
	}

	let { selectedIds, totalCount = 0 }: Props = $props();

	const dispatch = createEventDispatcher<{
		clear: void;
		selectAll: void;
	}>();

	// --- Action Dropdown State ---

	let showStatusMenu = $state(false);
	let showMoveMenu = $state(false);
	let showMilestoneMenu = $state(false);
	let confirmAction: { type: string; label: string; fn: () => Promise<void> } | null = $state(null);

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
			case PmStatus.CANCELLED:
				return 'Cancelled';
			case PmStatus.ARCHIVED:
				return 'Archived';
			default:
				return s;
		}
	}

	let count = $derived(selectedIds.size);
	let ids = $derived(Array.from(selectedIds));
	let allSelected = $derived(totalCount > 0 && count === totalCount);

	// --- Bulk Actions ---

	function requestBulkStatus(status: PmStatus): void {
		showStatusMenu = false;
		confirmAction = {
			type: 'status',
			label: `Change ${count} task${count === 1 ? '' : 's'} to "${statusLabel(status)}"?`,
			fn: async () => {
				await bulkUpdateTasks({ ids, status });
				dispatch('clear');
			}
		};
	}

	function requestBulkMove(projectId: number): void {
		showMoveMenu = false;
		const project = $pmProjects.find((p) => p.id === projectId);
		const name = project ? project.title : `#${projectId}`;
		confirmAction = {
			type: 'move',
			label: `Move ${count} task${count === 1 ? '' : 's'} to "${name}"?`,
			fn: async () => {
				await bulkMoveTasks({ ids, parentProjectId: projectId });
				dispatch('clear');
			}
		};
	}

	function requestBulkMilestone(milestoneId: number | undefined): void {
		showMilestoneMenu = false;
		const milestone = milestoneId != null ? $pmMilestones.find((m) => m.id === milestoneId) : null;
		const name = milestone ? milestone.name : 'None';
		confirmAction = {
			type: 'milestone',
			label: `Set milestone to "${name}" for ${count} task${count === 1 ? '' : 's'}?`,
			fn: async () => {
				await bulkUpdateTasks({ ids, milestoneId });
				dispatch('clear');
			}
		};
	}

	async function handleConfirm(): Promise<void> {
		if (!confirmAction) return;
		const fn = confirmAction.fn;
		confirmAction = null;
		await fn();
	}

	function handleCancel(): void {
		confirmAction = null;
	}

	function toggleSelectAll(): void {
		if (allSelected) {
			dispatch('clear');
		} else {
			dispatch('selectAll');
		}
	}

	function clearSelection(): void {
		dispatch('clear');
	}

	function closeMenus(): void {
		showStatusMenu = false;
		showMoveMenu = false;
		showMilestoneMenu = false;
	}

	// --- Status options ---
	const statusOptions: PmStatus[] = [
		PmStatus.TODO,
		PmStatus.IN_PROGRESS,
		PmStatus.REVIEW,
		PmStatus.DONE,
		PmStatus.CANCELLED,
		PmStatus.ARCHIVED
	];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if count > 0}
	<div
		class="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 shadow-xl"
		onclick={(e) => {
			e.stopPropagation();
		}}
	>
		<!-- Select all toggle -->
		<button
			onclick={toggleSelectAll}
			aria-label={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
			class="flex items-center focus-visible:ring-2 focus-visible:ring-blue-500 space-x-2 text-xs text-slate-300 hover:text-slate-100"
		>
			<span
				class="flex h-4 w-4 items-center justify-center rounded border {allSelected
					? 'border-blue-500 bg-blue-500/20'
					: 'border-slate-500'}"
			>
				{#if allSelected}
					<svg
						class="h-3 w-3 text-blue-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				{/if}
			</span>
			<span>{count} selected</span>
		</button>

		<div class="h-4 w-px bg-slate-600"></div>

		<!-- Change Status -->
		<div class="relative">
			<button
				onclick={() => {
					closeMenus();
					showStatusMenu = !showStatusMenu;
				}}
				class="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
			>
				Change Status
			</button>
			{#if showStatusMenu}
				<div
					class="absolute bottom-full left-0 mb-2 rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
				>
					{#each statusOptions as s (s)}
						<button
							onclick={() => requestBulkStatus(s)}
							class="block w-full whitespace-nowrap px-4 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
						>
							{statusLabel(s)}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Move to Project -->
		<div class="relative">
			<button
				onclick={() => {
					closeMenus();
					showMoveMenu = !showMoveMenu;
				}}
				class="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
			>
				Move
			</button>
			{#if showMoveMenu}
				<div
					class="absolute bottom-full left-0 mb-2 max-h-48 overflow-y-auto rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
				>
					{#each $pmProjects as project (project.id)}
						<button
							onclick={() => requestBulkMove(project.id)}
							class="block w-full whitespace-nowrap px-4 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
						>
							{project.title}
						</button>
					{/each}
					{#if $pmProjects.length === 0}
						<p class="px-4 py-2 text-xs text-slate-500">No projects</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Set Milestone -->
		<div class="relative">
			<button
				onclick={() => {
					closeMenus();
					showMilestoneMenu = !showMilestoneMenu;
				}}
				class="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
			>
				Set Milestone
			</button>
			{#if showMilestoneMenu}
				<div
					class="absolute bottom-full left-0 mb-2 max-h-48 overflow-y-auto rounded border border-slate-600 bg-slate-800 py-1 shadow-lg"
				>
					<button
						onclick={() => requestBulkMilestone(undefined)}
						class="block w-full whitespace-nowrap px-4 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-700"
					>
						None
					</button>
					{#each $pmMilestones as ms (ms.id)}
						<button
							onclick={() => requestBulkMilestone(ms.id)}
							class="block w-full whitespace-nowrap px-4 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700"
						>
							{ms.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="h-4 w-px bg-slate-600"></div>

		<!-- Clear Selection -->
		<button
			onclick={clearSelection}
			class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
			title="Clear selection"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
{/if}

<ConfirmDialog
	open={confirmAction != null}
	title="Confirm Bulk Action"
	message={confirmAction ? confirmAction.label : ''}
	confirmLabel="Confirm"
	onconfirm={handleConfirm}
	oncancel={handleCancel}
/>
