<script lang="ts">
	import {
		loadProjects,
		createProject,
		projects,
		projectsLoading,
		type Project
	} from '$lib/stores/pm-projects.js';
	import {
		domains,
		focuses,
		milestones,
		type Domain,
		type Focus,
		type Milestone
	} from '$lib/stores/pm-domains.js';

	interface Props {
		domainFilter?: string | null;
		focusFilter?: string | null;
		onselect?: (projectId: number) => void;
	}

	let { domainFilter = null, focusFilter = null, onselect }: Props = $props();

	let projectList = $state<Project[]>([]);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- populated by subscription, used for future domain filtering
	let domainList = $state<Domain[]>([]);
	let focusList = $state<Focus[]>([]);
	let milestoneList = $state<Milestone[]>([]);
	let loading = $state(false);

	// Filters
	let statusFilter = $state('');
	let priorityFilter = $state('');
	let milestoneFilter = $state('');
	let dueDateFrom = $state('');
	let dueDateTo = $state('');
	let overdueOnly = $state(false);

	// Sort
	type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'last_activity_at' | 'focus_id';
	type SortDir = 'asc' | 'desc';
	let sortField = $state<SortField>('last_activity_at');
	let sortDir = $state<SortDir>('desc');

	// Pagination
	let page = $state(0);
	const pageSize = 50;

	// Show create form
	let showCreate = $state(false);
	let newTitle = $state('');
	let newFocusId = $state('');
	let newDescription = $state('');
	let creating = $state(false);

	$effect(() => {
		const u1 = projects.subscribe((v) => {
			projectList = v;
		});
		const u2 = domains.subscribe((v) => {
			domainList = v;
		});
		const u3 = focuses.subscribe((v) => {
			focusList = v;
		});
		const u4 = milestones.subscribe((v) => {
			milestoneList = v;
		});
		const u5 = projectsLoading.subscribe((v) => {
			loading = v;
		});
		return () => {
			u1();
			u2();
			u3();
			u4();
			u5();
		};
	});

	$effect(() => {
		loadProjects(focusFilter ? { focus_id: focusFilter } : undefined);
	});

	// Computed filtered + sorted + paginated
	const filtered = $derived.by(() => {
		let result = projectList;

		// Apply domain filter (via focus)
		if (domainFilter) {
			const domainFocusIds = focusList.filter((f) => f.domain_id === domainFilter).map((f) => f.id);
			result = result.filter((p) => domainFocusIds.includes(p.focus_id));
		}

		// Apply status filter
		if (statusFilter) {
			result = result.filter((p) => p.status === statusFilter);
		}

		// Apply priority filter
		if (priorityFilter) {
			result = result.filter((p) => p.priority === priorityFilter);
		}

		// Apply milestone filter
		if (milestoneFilter) {
			const mid = Number(milestoneFilter);
			result = result.filter((p) => p.milestone_id === mid);
		}

		// Apply due date range
		if (dueDateFrom) {
			result = result.filter((p) => p.due_date && p.due_date >= dueDateFrom);
		}
		if (dueDateTo) {
			result = result.filter((p) => p.due_date && p.due_date <= dueDateTo);
		}

		// Apply overdue filter
		if (overdueOnly) {
			const now = new Date().toISOString().split('T')[0];
			result = result.filter((p) => p.due_date && p.due_date < now && p.status !== 'done');
		}

		return result;
	});

	const sorted = $derived.by(() => {
		const result = [...filtered];
		result.sort((a, b) => {
			let aVal: string | number | null;
			let bVal: string | number | null;

			if (sortField === 'title') {
				aVal = a.title.toLowerCase();
				bVal = b.title.toLowerCase();
			} else if (sortField === 'status') {
				aVal = a.status;
				bVal = b.status;
			} else if (sortField === 'priority') {
				const priorityOrder: Record<string, number> = {
					urgent: 4,
					high: 3,
					normal: 2,
					low: 1
				};
				aVal = priorityOrder[a.priority || 'normal'];
				bVal = priorityOrder[b.priority || 'normal'];
			} else if (sortField === 'due_date') {
				aVal = a.due_date || '';
				bVal = b.due_date || '';
			} else if (sortField === 'last_activity_at') {
				aVal = a.last_activity_at;
				bVal = b.last_activity_at;
			} else if (sortField === 'focus_id') {
				aVal = a.focus_id;
				bVal = b.focus_id;
			} else {
				return 0;
			}

			if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
			return 0;
		});
		return result;
	});

	const paginated = $derived.by(() => {
		const start = page * pageSize;
		return sorted.slice(start, start + pageSize);
	});

	const totalPages = $derived(Math.ceil(sorted.length / pageSize));

	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'asc';
		}
		page = 0;
	}

	function handleRowClick(projectId: number) {
		if (onselect) {
			onselect(projectId);
		}
	}

	async function handleCreate() {
		if (!newTitle.trim() || !newFocusId) return;
		creating = true;
		try {
			await createProject({
				focus_id: newFocusId,
				title: newTitle.trim(),
				description: newDescription.trim() || undefined
			});
			newTitle = '';
			newFocusId = '';
			newDescription = '';
			showCreate = false;
		} finally {
			creating = false;
		}
	}

	function getFocusName(focusId: string): string {
		return focusList.find((f) => f.id === focusId)?.name || focusId;
	}

	function getMilestoneName(milestoneId: number | null): string {
		if (!milestoneId) return '';
		return milestoneList.find((m) => m.id === milestoneId)?.name || '';
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			todo: 'bg-gray-600 text-gray-200',
			in_progress: 'bg-blue-600 text-blue-100',
			review: 'bg-yellow-600 text-yellow-100',
			done: 'bg-green-600 text-green-100',
			cancelled: 'bg-red-600 text-red-100'
		};
		return colors[status] || 'bg-gray-600 text-gray-200';
	}

	function getPriorityColor(priority: string | null): string {
		const colors: Record<string, string> = {
			low: 'bg-gray-600 text-gray-200',
			normal: 'bg-blue-600 text-blue-100',
			high: 'bg-orange-600 text-orange-100',
			urgent: 'bg-red-600 text-red-100'
		};
		return colors[priority || 'normal'] || 'bg-gray-600 text-gray-200';
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		return dateStr;
	}

	function isOverdue(project: Project): boolean {
		if (!project.due_date || project.status === 'done') return false;
		const now = new Date().toISOString().split('T')[0];
		return project.due_date < now;
	}

	function clearFilters() {
		statusFilter = '';
		priorityFilter = '';
		milestoneFilter = '';
		dueDateFrom = '';
		dueDateTo = '';
		overdueOnly = false;
		page = 0;
	}

	function getSortIcon(field: SortField): string {
		if (sortField !== field) return '↕';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	function prevPage() {
		if (page > 0) page--;
	}

	function nextPage() {
		if (page < totalPages - 1) page++;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Filter bar -->
	<div class="flex items-center gap-3 border-b border-gray-800 px-4 py-2">
		<select
			class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
			bind:value={statusFilter}
			onchange={() => {
				page = 0;
			}}
		>
			<option value="">All Statuses</option>
			<option value="todo">To Do</option>
			<option value="in_progress">In Progress</option>
			<option value="review">Review</option>
			<option value="done">Done</option>
			<option value="cancelled">Cancelled</option>
		</select>

		<select
			class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
			bind:value={priorityFilter}
			onchange={() => {
				page = 0;
			}}
		>
			<option value="">All Priorities</option>
			<option value="low">Low</option>
			<option value="normal">Normal</option>
			<option value="high">High</option>
			<option value="urgent">Urgent</option>
		</select>

		<select
			class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
			bind:value={milestoneFilter}
			onchange={() => {
				page = 0;
			}}
		>
			<option value="">All Milestones</option>
			{#each milestoneList as milestone (milestone.id)}
				<option value={milestone.id}>{milestone.name}</option>
			{/each}
		</select>

		<label class="flex items-center gap-1 text-xs text-gray-300">
			<input type="checkbox" bind:checked={overdueOnly} onchange={() => (page = 0)} />
			Overdue Only
		</label>

		<input
			type="date"
			class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
			bind:value={dueDateFrom}
			placeholder="Due from"
			onchange={() => {
				page = 0;
			}}
		/>

		<input
			type="date"
			class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
			bind:value={dueDateTo}
			placeholder="Due to"
			onchange={() => {
				page = 0;
			}}
		/>

		<button
			class="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white hover:bg-gray-700"
			onclick={clearFilters}
		>
			Clear
		</button>

		<div class="flex-1"></div>

		<button
			class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
			onclick={() => {
				showCreate = !showCreate;
			}}
		>
			New Project
		</button>
	</div>

	<!-- Create form -->
	{#if showCreate}
		<div class="border-b border-gray-800 bg-gray-900 px-4 py-3">
			<div class="flex items-end gap-3">
				<div class="flex-1">
					<label class="mb-1 block text-xs text-gray-400">Title</label>
					<input
						type="text"
						class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
						bind:value={newTitle}
						placeholder="Project title"
					/>
				</div>
				<div class="w-48">
					<label class="mb-1 block text-xs text-gray-400">Focus</label>
					<select
						class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
						bind:value={newFocusId}
					>
						<option value="">Select focus</option>
						{#each focusList as focus (focus.id)}
							<option value={focus.id}>{focus.name}</option>
						{/each}
					</select>
				</div>
				<div class="flex-1">
					<label class="mb-1 block text-xs text-gray-400">Description (optional)</label>
					<input
						type="text"
						class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
						bind:value={newDescription}
						placeholder="Brief description"
					/>
				</div>
				<button
					class="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-500 disabled:bg-gray-600"
					onclick={handleCreate}
					disabled={!newTitle.trim() || !newFocusId || creating}
				>
					{creating ? 'Creating...' : 'Create'}
				</button>
				<button
					class="rounded border border-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-800"
					onclick={() => {
						showCreate = false;
					}}
					disabled={creating}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Table -->
	<div class="flex-1 overflow-auto">
		{#if loading}
			<div class="flex h-full items-center justify-center text-sm text-gray-400">Loading...</div>
		{:else if paginated.length === 0}
			<div class="flex h-full items-center justify-center text-sm text-gray-400">
				No projects found
			</div>
		{:else}
			<table class="w-full text-xs">
				<thead class="sticky top-0 bg-gray-900">
					<tr class="border-b border-gray-800">
						<th
							class="cursor-pointer px-3 py-2 text-left font-medium text-gray-500 hover:text-white"
							onclick={() => handleSort('title')}
						>
							Title {getSortIcon('title')}
						</th>
						<th
							class="cursor-pointer px-3 py-2 text-left font-medium text-gray-500 hover:text-white"
							onclick={() => handleSort('status')}
						>
							Status {getSortIcon('status')}
						</th>
						<th
							class="cursor-pointer px-3 py-2 text-left font-medium text-gray-500 hover:text-white"
							onclick={() => handleSort('priority')}
						>
							Priority {getSortIcon('priority')}
						</th>
						<th
							class="cursor-pointer px-3 py-2 text-left font-medium text-gray-500 hover:text-white"
							onclick={() => handleSort('due_date')}
						>
							Due Date {getSortIcon('due_date')}
						</th>
						<th
							class="cursor-pointer px-3 py-2 text-left font-medium text-gray-500 hover:text-white"
							onclick={() => handleSort('focus_id')}
						>
							Focus {getSortIcon('focus_id')}
						</th>
						<th class="px-3 py-2 text-left font-medium text-gray-500">Milestone</th>
						<th
							class="cursor-pointer px-3 py-2 text-left font-medium text-gray-500 hover:text-white"
							onclick={() => handleSort('last_activity_at')}
						>
							Last Activity {getSortIcon('last_activity_at')}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each paginated as project (project.id)}
						<tr
							class="cursor-pointer border-b border-gray-800 hover:bg-gray-800"
							onclick={() => handleRowClick(project.id)}
						>
							<td class="px-3 py-2 text-gray-300">
								<div class="flex items-center gap-2">
									{#if isOverdue(project)}
										<span class="text-red-500" title="Overdue">⚠</span>
									{/if}
									{project.title}
								</div>
							</td>
							<td class="px-3 py-2">
								<span
									class="inline-block rounded px-2 py-1 text-xs {getStatusColor(project.status)}"
								>
									{project.status.replace('_', ' ')}
								</span>
							</td>
							<td class="px-3 py-2">
								<span
									class="inline-block rounded px-2 py-1 text-xs {getPriorityColor(
										project.priority
									)}"
								>
									{project.priority || 'normal'}
								</span>
							</td>
							<td class="px-3 py-2 text-gray-300">
								{formatDate(project.due_date)}
							</td>
							<td class="px-3 py-2 text-gray-300">
								{getFocusName(project.focus_id)}
							</td>
							<td class="px-3 py-2 text-gray-300">
								{getMilestoneName(project.milestone_id)}
							</td>
							<td class="px-3 py-2 text-gray-400">
								{new Date(project.last_activity_at * 1000).toLocaleDateString()}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Pagination -->
	<div class="flex items-center justify-between border-t border-gray-800 px-4 py-2 text-xs">
		<div class="text-gray-400">
			Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
			projects
		</div>
		<div class="flex items-center gap-2">
			<button
				class="rounded border border-gray-700 px-2 py-1 text-white hover:bg-gray-800 disabled:text-gray-600"
				onclick={prevPage}
				disabled={page === 0}
			>
				Previous
			</button>
			<span class="text-gray-400">Page {page + 1} of {totalPages || 1}</span>
			<button
				class="rounded border border-gray-700 px-2 py-1 text-white hover:bg-gray-800 disabled:text-gray-600"
				onclick={nextPage}
				disabled={page >= totalPages - 1}
			>
				Next
			</button>
		</div>
	</div>
</div>
