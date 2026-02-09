<script lang="ts">
	import { PmStatus, PmPriority } from '$lib/types';
	import { pmProjects, pmFocuses, pmTasks } from '$lib/stores';

	// --- Props ---

	interface Props {
		/** Filter by domain id (null = no domain filter) */
		selectedDomainId?: string | null;
		/** Filter by focus id (null = no focus filter) */
		selectedFocusId?: string | null;
		/** Called when a project row is clicked */
		onselect?: (data: { projectId: number }) => void;
	}

	let { selectedDomainId = null, selectedFocusId = null, onselect }: Props = $props();

	// --- Filter / Sort State ---

	let statusFilter: PmStatus | '' = $state('');
	let priorityFilter: PmPriority | '' = $state('');
	let sortField: 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' = $state('createdAt');
	let sortAsc = $state(false);

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

	function statusColor(s: PmStatus): string {
		switch (s) {
			case PmStatus.TODO:
				return 'bg-slate-600/30 text-slate-300';
			case PmStatus.IN_PROGRESS:
				return 'bg-blue-600/20 text-blue-400';
			case PmStatus.REVIEW:
				return 'bg-purple-600/20 text-purple-400';
			case PmStatus.DONE:
				return 'bg-green-600/20 text-green-400';
			case PmStatus.CANCELLED:
				return 'bg-red-600/20 text-red-400';
			case PmStatus.ARCHIVED:
				return 'bg-slate-600/20 text-slate-500';
			default:
				return 'bg-slate-600/20 text-slate-400';
		}
	}

	function priorityColor(p: PmPriority | undefined): string {
		switch (p) {
			case PmPriority.URGENT:
				return 'text-red-400';
			case PmPriority.HIGH:
				return 'text-orange-400';
			case PmPriority.NORMAL:
				return 'text-slate-300';
			case PmPriority.LOW:
				return 'text-slate-500';
			default:
				return 'text-slate-400';
		}
	}

	function priorityLabel(p: PmPriority | undefined): string {
		switch (p) {
			case PmPriority.URGENT:
				return 'Urgent';
			case PmPriority.HIGH:
				return 'High';
			case PmPriority.NORMAL:
				return 'Normal';
			case PmPriority.LOW:
				return 'Low';
			default:
				return '\u2014';
		}
	}

	function formatDueDate(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const due = new Date(d);
		due.setHours(0, 0, 0, 0);
		const diff = due.getTime() - now.getTime();
		const days = Math.round(diff / (1000 * 60 * 60 * 24));
		if (days < 0) return `${Math.abs(days)}d overdue`;
		if (days === 0) return 'Today';
		if (days === 1) return 'Tomorrow';
		return `${days}d`;
	}

	function isDueOverdue(dateStr: string): boolean {
		const d = new Date(dateStr);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return d.getTime() < now.getTime();
	}

	function getFocusName(focusId: string): string {
		const focus = $pmFocuses.find((f) => f.id === focusId);
		return focus ? focus.name : focusId;
	}

	function getTaskCount(projectId: number): number {
		return $pmTasks.filter((t) => t.parentProjectId === projectId).length;
	}

	// Priority sort weight (higher priority = lower number for ascending)
	function prioritySortWeight(p: PmPriority | undefined): number {
		switch (p) {
			case PmPriority.URGENT:
				return 0;
			case PmPriority.HIGH:
				return 1;
			case PmPriority.NORMAL:
				return 2;
			case PmPriority.LOW:
				return 3;
			default:
				return 4;
		}
	}

	// Status sort weight
	function statusSortWeight(s: PmStatus): number {
		switch (s) {
			case PmStatus.IN_PROGRESS:
				return 0;
			case PmStatus.REVIEW:
				return 1;
			case PmStatus.TODO:
				return 2;
			case PmStatus.DONE:
				return 3;
			case PmStatus.CANCELLED:
				return 4;
			case PmStatus.ARCHIVED:
				return 5;
			default:
				return 6;
		}
	}

	// --- Derived data ---

	// Get focus IDs for the selected domain
	let domainFocusIds = $derived(
		selectedDomainId
			? new Set($pmFocuses.filter((f) => f.domainId === selectedDomainId).map((f) => f.id))
			: null
	);

	let filteredProjects = $derived(
		$pmProjects
			.filter((p) => {
				// Focus filter (from sidebar)
				if (selectedFocusId && p.focusId !== selectedFocusId) return false;
				// Domain filter (from sidebar, if no specific focus)
				if (!selectedFocusId && domainFocusIds && !domainFocusIds.has(p.focusId)) return false;
				// Status filter (from filter bar)
				if (statusFilter && p.status !== statusFilter) return false;
				// Priority filter (from filter bar)
				if (priorityFilter && p.priority !== priorityFilter) return false;
				return true;
			})
			.sort((a, b) => {
				let cmp = 0;
				switch (sortField) {
					case 'title':
						cmp = a.title.localeCompare(b.title);
						break;
					case 'status':
						cmp = statusSortWeight(a.status) - statusSortWeight(b.status);
						break;
					case 'priority':
						cmp = prioritySortWeight(a.priority) - prioritySortWeight(b.priority);
						break;
					case 'dueDate': {
						const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
						const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
						cmp = da - db;
						break;
					}
					case 'createdAt':
						cmp = a.createdAt - b.createdAt;
						break;
				}
				return sortAsc ? cmp : -cmp;
			})
	);

	// --- Sort ---

	function toggleSort(field: typeof sortField): void {
		if (sortField === field) {
			sortAsc = !sortAsc;
		} else {
			sortField = field;
			sortAsc = field === 'title'; // title defaults ascending, others descending
		}
	}

	function sortIndicator(field: typeof sortField): string {
		if (sortField !== field) return '';
		return sortAsc ? '\u25B2' : '\u25BC';
	}

	// --- Navigation ---

	function selectProject(projectId: number): void {
		onselect?.({ projectId });
	}

	// --- Status enum values for filter dropdown ---
	const statusOptions: PmStatus[] = [
		PmStatus.TODO,
		PmStatus.IN_PROGRESS,
		PmStatus.REVIEW,
		PmStatus.DONE,
		PmStatus.CANCELLED,
		PmStatus.ARCHIVED
	];

	const priorityOptions: PmPriority[] = [
		PmPriority.URGENT,
		PmPriority.HIGH,
		PmPriority.NORMAL,
		PmPriority.LOW
	];
</script>

<div class="flex h-full flex-col">
	<!-- Filter Bar -->
	<div class="flex flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-3">
		<div class="flex items-center space-x-2">
			<label for="status-filter" class="text-xs font-medium text-slate-400">Status</label>
			<select
				id="status-filter"
				bind:value={statusFilter}
				class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
			>
				<option value="">All</option>
				{#each statusOptions as s (s)}
					<option value={s}>{statusLabel(s)}</option>
				{/each}
			</select>
		</div>

		<div class="flex items-center space-x-2">
			<label for="priority-filter" class="text-xs font-medium text-slate-400">Priority</label>
			<select
				id="priority-filter"
				bind:value={priorityFilter}
				class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
			>
				<option value="">All</option>
				{#each priorityOptions as p (p)}
					<option value={p}>{priorityLabel(p)}</option>
				{/each}
			</select>
		</div>

		<div class="ml-auto text-xs text-slate-500">
			{filteredProjects.length}
			{filteredProjects.length === 1 ? 'project' : 'projects'}
		</div>
	</div>

	<!-- Table -->
	<div class="flex-1 overflow-auto">
		{#if filteredProjects.length === 0}
			<div class="flex flex-col items-center justify-center p-12">
				<svg
					class="mb-3 h-10 w-10 text-slate-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
				<p class="text-sm text-slate-400">No projects match current filters</p>
			</div>
		{:else}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-slate-700 text-xs uppercase text-slate-400">
						<th class="px-4 py-3 font-medium">
							<button
								onclick={() => toggleSort('title')}
								class="flex items-center space-x-1 hover:text-slate-200"
							>
								<span>Title</span>
								<span class="text-blue-400">{sortIndicator('title')}</span>
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button
								onclick={() => toggleSort('status')}
								class="flex items-center space-x-1 hover:text-slate-200"
							>
								<span>Status</span>
								<span class="text-blue-400">{sortIndicator('status')}</span>
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button
								onclick={() => toggleSort('priority')}
								class="flex items-center space-x-1 hover:text-slate-200"
							>
								<span>Priority</span>
								<span class="text-blue-400">{sortIndicator('priority')}</span>
							</button>
						</th>
						<th class="hidden px-4 py-3 font-medium sm:table-cell">Focus</th>
						<th class="px-4 py-3 font-medium">
							<button
								onclick={() => toggleSort('dueDate')}
								class="flex items-center space-x-1 hover:text-slate-200"
							>
								<span>Due Date</span>
								<span class="text-blue-400">{sortIndicator('dueDate')}</span>
							</button>
						</th>
						<th class="hidden px-4 py-3 text-right font-medium md:table-cell">Tasks</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredProjects as project (project.id)}
						<tr
							class="group cursor-pointer border-b border-slate-700/50 transition-colors hover:bg-slate-800/50"
							onclick={() => selectProject(project.id)}
						>
							<td class="px-4 py-3">
								<p class="font-medium text-slate-200">{project.title}</p>
								{#if project.description}
									<p class="mt-0.5 truncate text-xs text-slate-500">
										{project.description}
									</p>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-block rounded px-2 py-0.5 text-xs font-medium {statusColor(
										project.status
									)}"
								>
									{statusLabel(project.status)}
								</span>
							</td>
							<td class="px-4 py-3">
								<span class="text-xs font-medium {priorityColor(project.priority)}">
									{priorityLabel(project.priority)}
								</span>
							</td>
							<td class="hidden px-4 py-3 sm:table-cell">
								<span class="text-xs text-slate-400">
									{getFocusName(project.focusId)}
								</span>
							</td>
							<td class="px-4 py-3">
								{#if project.dueDate}
									<span
										class="whitespace-nowrap text-xs font-medium {isDueOverdue(project.dueDate)
											? 'text-red-400'
											: 'text-slate-300'}"
									>
										{formatDueDate(project.dueDate)}
									</span>
								{:else}
									<span class="text-xs text-slate-600">&mdash;</span>
								{/if}
							</td>
							<td class="hidden px-4 py-3 text-right md:table-cell">
								<span class="text-xs text-slate-400">
									{getTaskCount(project.id)}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
