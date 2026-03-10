<script lang="ts">
	import {
		loadProjects,
		projects,
		projectsLoading,
		createProject,
		type Project
	} from '$lib/stores/pm-projects.js';
	import {
		categories,
		subcategories,
		loadCategories,
		loadSubcategories,
		type Category,
		type Subcategory,
		getSubcategoriesByCategory
	} from '$lib/stores/pm-categories.js';
	import {
		getPMStats,
		getDashboardContext,
		type PMStats,
		type DashboardContext
	} from '$lib/stores/pm-operations.js';
	import { SvelteSet } from 'svelte/reactivity';
	import { formatDueDate, formatStatusLabel } from './pm-utils.js';
	import { getStatusColor, BADGE, getPriority } from '$lib/components/ui/design-tokens.js';

	interface Props {
		onselect?: (projectId: number) => void;
		selectedId?: number | null;
	}

	let { onselect, selectedId = null }: Props = $props();

	let projectList = $state<Project[]>([]);
	let categoryList = $state<Category[]>([]);
	let subcategoryList = $state<Subcategory[]>([]);
	let loading = $state(false);
	let filterMode = $state<'active' | 'all' | 'done' | 'archived'>('active');
	let searchQuery = $state('');
	let collapsedCategories = new SvelteSet<string>();
	let dashStats = $state<PMStats | null>(null);
	let dashContext = $state<DashboardContext | null>(null);

	// New project form state
	let showNewForm = $state(false);
	let newTitle = $state('');
	let newCategoryId = $state('');
	let newSubcategoryId = $state('');
	let newStatus = $state('todo');
	let newPriority = $state('');
	let newDueDate = $state('');
	let newDescription = $state('');

	$effect(() => {
		const u1 = projects.subscribe((v) => {
			projectList = v;
		});
		const u2 = categories.subscribe((v) => {
			categoryList = v;
		});
		const u3 = subcategories.subscribe((v) => {
			subcategoryList = v;
		});
		const u4 = projectsLoading.subscribe((v) => {
			loading = v;
		});
		return () => {
			u1();
			u2();
			u3();
			u4();
		};
	});

	$effect(() => {
		loadProjects();
		loadCategories();
		loadSubcategories();
		Promise.all([getPMStats(), getDashboardContext()])
			.then(([s, c]) => {
				dashStats = s;
				dashContext = c;
			})
			.catch((err) => {
				console.error('[PM] Failed to load dashboard stats/context:', err);
			});
	});

	/** Project list grouped by category with subcategory names inline */
	interface CategoryGroup {
		category: Category;
		projects: Project[];
		/** Maps subcategory_id -> subcategory.name for inline display */
		subcategoryNames: Record<string, string>;
		projectCount: number;
	}

	function sortProjects(projs: Project[]): Project[] {
		return [...projs].sort((a, b) => {
			if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
			if (a.due_date && !b.due_date) return -1;
			if (!a.due_date && b.due_date) return 1;
			return b.last_activity_at - a.last_activity_at;
		});
	}

	const filtered = $derived.by(() => {
		let result = projectList.filter((p) => {
			switch (filterMode) {
				case 'active':
					return p.status === 'todo' || p.status === 'in_progress' || p.status === 'review';
				case 'done':
					return p.status === 'done';
				case 'archived':
					return p.status === 'archived' || p.status === 'cancelled';
				case 'all':
					return true;
			}
		});

		// Apply search filter
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter((p) =>
				p.title.toLowerCase().includes(q) ||
				p.description?.toLowerCase().includes(q)
			);
		}

		return result;
	});

	const grouped = $derived.by(() => {
		const subcategoryMap: Record<string, Subcategory> = {};
		for (const s of subcategoryList) subcategoryMap[s.id] = s;

		const projectsByCategory: Record<string, Project[]> = {};
		const subcategoryNamesByCategory: Record<string, Record<string, string>> = {};

		for (const p of filtered) {
			if (!projectsByCategory[p.category_id]) {
				projectsByCategory[p.category_id] = [];
				subcategoryNamesByCategory[p.category_id] = {};
			}
			projectsByCategory[p.category_id].push(p);
			if (p.subcategory_id) {
				const subcategory = subcategoryMap[p.subcategory_id];
				if (subcategory) {
					subcategoryNamesByCategory[p.category_id][p.subcategory_id] = subcategory.name;
				}
			}
		}

		for (const key of Object.keys(projectsByCategory)) {
			projectsByCategory[key] = sortProjects(projectsByCategory[key]);
		}

		const result: CategoryGroup[] = [];
		const sortedCategories = [...categoryList].sort((a, b) => a.sort_order - b.sort_order);

		for (const category of sortedCategories) {
			const projs = projectsByCategory[category.id];
			if (projs && projs.length > 0) {
				result.push({
					category,
					projects: projs,
					subcategoryNames: subcategoryNamesByCategory[category.id] || {},
					projectCount: projs.length
				});
			}
		}

		return result;
	});

	// Orphan projects: category doesn't exist
	const orphanProjects = $derived.by(() => {
		const knownCategoryIds: Record<string, true> = {};
		for (const c of categoryList) knownCategoryIds[c.id] = true;
		return sortProjects(filtered.filter((p) => !knownCategoryIds[p.category_id]));
	});

	function toggleCategory(categoryId: string) {
		if (collapsedCategories.has(categoryId)) {
			collapsedCategories.delete(categoryId);
		} else {
			collapsedCategories.add(categoryId);
		}
	}

	// New project form functions
	function resetForm() {
		newTitle = '';
		newCategoryId = '';
		newSubcategoryId = '';
		newStatus = 'todo';
		newPriority = '';
		newDueDate = '';
		newDescription = '';
		showNewForm = false;
	}

	const availableSubcategories = $derived.by(() => {
		if (!newCategoryId) return [];
		return getSubcategoriesByCategory(newCategoryId);
	});

	async function handleCreateProject() {
		if (!newTitle.trim() || !newCategoryId) return;

		try {
			await createProject({
				title: newTitle.trim(),
				category_id: newCategoryId,
				subcategory_id: newSubcategoryId || undefined,
				status: newStatus,
				priority: newPriority || undefined,
				due_date: newDueDate || undefined,
				description: newDescription.trim() || undefined
			});
			resetForm();
		} catch (err) {
			console.error('Failed to create project:', err);
		}
	}

	const filters: Array<{ key: typeof filterMode; label: string }> = [
		{ key: 'active', label: 'Active' },
		{ key: 'all', label: 'All' },
		{ key: 'done', label: 'Done' },
		{ key: 'archived', label: 'Archived' }
	];

	const statusOptions = [
		{ value: 'todo', label: 'To Do' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'review', label: 'Review' },
		{ value: 'done', label: 'Done' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'archived', label: 'Archived' }
	];

	const priorityOptions = [
		{ value: '', label: '—' },
		{ value: 'urgent', label: 'Urgent' },
		{ value: 'high', label: 'High' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'low', label: 'Low' }
	];
</script>

{#snippet projectRow(project: Project, accentColor: string, subcategoryName: string | null)}
	{@const statusKey = getStatusColor(project.status)}
	{@const due = formatDueDate(project.due_date)}
	{@const pri = getPriority(project.priority)}
	{@const isSelected = selectedId === project.id}
	<button
		class="relative mx-2 my-[2px] flex items-center gap-2.5 overflow-hidden rounded-lg py-2.5 pl-5 pr-3 text-left transition-colors {isSelected
			? 'bg-surface-3'
			: 'hover:bg-surface-3/60'}"
		onclick={() => onselect?.(project.id)}
	>
		<!-- 5px colored left accent bar -->
		<span class="absolute bottom-1 left-0 top-1 w-[5px] rounded-r" style="background: {accentColor}"
		></span>

		<!-- Title + subcategory on same line -->
		<span
			class="min-w-0 flex-1 truncate text-[length:var(--text-card-title)] font-medium text-white"
		>
			{project.title}
			{#if subcategoryName}
				<span class="ml-1.5 text-[length:var(--text-label)] font-normal text-status-muted"
					>· {subcategoryName}</span
				>
			{/if}
		</span>

		<!-- Status pill -->
		<span class="shrink-0 {BADGE.status(statusKey)}">
			{formatStatusLabel(project.status)}
		</span>

		<!-- Priority emoji -->
		{#if pri}
			<span class="shrink-0 text-[12px]">{pri.emoji}</span>
		{/if}

		<!-- Due date -->
		{#if due}
			<span class="shrink-0 text-[length:var(--text-label)] {due.color}">{due.text}</span>
		{/if}
	</button>
{/snippet}

<div class="flex h-full flex-col overflow-auto">
	{#if loading}
		<div
			class="flex flex-1 items-center justify-center text-[length:var(--text-body)] text-status-muted"
		>
			Loading...
		</div>
	{:else}
		<!-- Header: stats, filters, search, + New -->
		<div class="border-b border-surface-border bg-surface-1 px-4 py-2.5">
			{#if dashStats}
				<div class="mb-2 flex items-center gap-4 text-[length:var(--text-label)]">
					<span class="text-status-muted"
						>Total <span class="font-medium text-white">{dashStats.projects.total}</span></span
					>
					<span class="text-status-muted"
						>Active <span class="font-medium text-status-active"
							>{dashStats.projects.byStatus.in_progress || 0}</span
						></span
					>
					<span class="text-status-muted"
						>Due Soon <span class="font-medium text-status-warning"
							>{dashContext?.dueSoon?.length ?? 0}</span
						></span
					>
					<span class="text-status-muted"
						>Overdue <span class="font-medium text-status-danger">{dashStats.overdue}</span></span
					>
				</div>
			{/if}

			<!-- Filter pills and controls -->
			<div class="mb-3 flex items-center gap-2">
				<div class="flex gap-1.5">
					{#each filters as f (f.key)}
						<button
							class="rounded-full px-3 py-1 text-[length:var(--text-badge)] font-medium transition-all duration-150 {filterMode ===
							f.key
								? 'bg-surface-3 text-white'
								: 'text-status-muted hover:text-white'}"
							onclick={() => {
								filterMode = f.key;
							}}
						>
							{f.label}
						</button>
					{/each}
				</div>

				<div class="flex-1"></div>

				<!-- + New Project button -->
				<button
					class="rounded-lg bg-status-active px-3 py-1.5 text-[length:var(--text-badge)] font-medium text-white hover:bg-status-active/80"
					onclick={() => (showNewForm = !showNewForm)}
				>
					+ New Project
				</button>
			</div>

			<!-- Search input -->
			<div class="relative">
				<input
					type="text"
					placeholder="Search projects..."
					bind:value={searchQuery}
					class="w-full rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
				/>
				<svg
					class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-status-muted"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<circle cx="11" cy="11" r="8"></circle>
					<path d="m21 21-4.35-4.35"></path>
				</svg>
			</div>
		</div>

		<!-- New project form -->
		{#if showNewForm}
			<div class="border-b border-surface-border bg-surface-2 px-4 py-4">
				<h3 class="mb-3 text-[length:var(--text-card-title)] font-medium text-white">
					New Project
				</h3>
				<div class="space-y-3">
					<!-- Title (required) -->
					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Title *
						</label>
						<input
							type="text"
							bind:value={newTitle}
							placeholder="Project title"
							class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
						/>
					</div>

					<!-- Category (required) -->
					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Category *
						</label>
						<select
							bind:value={newCategoryId}
							class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
						>
							<option value="">Select a category</option>
							{#each categoryList as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>

					<!-- Subcategory (optional) -->
					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Subcategory
						</label>
						<select
							bind:value={newSubcategoryId}
							disabled={!newCategoryId}
							class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none disabled:opacity-50"
						>
							<option value="">None</option>
							{#each availableSubcategories as subcategory (subcategory.id)}
								<option value={subcategory.id}>{subcategory.name}</option>
							{/each}
						</select>
					</div>

					<!-- Status, Priority, Due date row -->
					<div class="grid grid-cols-3 gap-3">
						<div>
							<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
								Status
							</label>
							<select
								bind:value={newStatus}
								class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
							>
								{#each statusOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
								Priority
							</label>
							<select
								bind:value={newPriority}
								class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
							>
								{#each priorityOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
								Due Date
							</label>
							<input
								type="date"
								bind:value={newDueDate}
								class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
							/>
						</div>
					</div>

					<!-- Description -->
					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Description
						</label>
						<textarea
							bind:value={newDescription}
							placeholder="Project description"
							rows="3"
							class="mt-1 w-full rounded-lg border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none resize-none"
						></textarea>
					</div>

					<!-- Actions -->
					<div class="flex gap-2">
						<button
							onclick={handleCreateProject}
							disabled={!newTitle.trim() || !newCategoryId}
							class="rounded-lg bg-status-active px-4 py-2 text-[length:var(--text-body)] font-medium text-white hover:bg-status-active/80 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Create Project
						</button>
						<button
							onclick={resetForm}
							class="rounded-lg border border-surface-border bg-surface-1 px-4 py-2 text-[length:var(--text-body)] text-white hover:bg-surface-3"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Grouped project list -->
		<div class="flex-1 overflow-y-auto">
			{#if grouped.length === 0 && orphanProjects.length === 0}
				<div
					class="flex items-center justify-center p-8 text-[length:var(--text-body)] text-status-muted"
				>
					{searchQuery.trim() ? 'No projects match your search' : 'No projects found'}
				</div>
			{:else}
				{#each grouped as group (group.category.id)}
					{@const accentColor = group.category.color || '#6b7280'}

					<!-- Category section header -->
					<button
						class="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-surface-3/40"
						onclick={() => toggleCategory(group.category.id)}
					>
						<svg
							class="h-3 w-3 text-status-muted transition-transform duration-200 {collapsedCategories.has(
								group.category.id
							)
								? '-rotate-90'
								: ''}"
							fill="currentColor"
							viewBox="0 0 12 12"
						>
							<path d="M2 4l4 4 4-4z" />
						</svg>
						<span
							class="text-[length:var(--text-section-header)] font-bold uppercase tracking-wider"
							style="color: {accentColor}"
						>
							{group.category.name}
						</span>
						<span class="text-[length:var(--text-label)] text-status-muted/50"
							>({group.projectCount})</span
						>
					</button>

					<!-- Projects in category -->
					<div
						class="collapse-section {collapsedCategories.has(group.category.id) ? 'collapsed' : ''}"
					>
						<div>
							{#each group.projects as project (project.id)}
								{@render projectRow(
									project,
									accentColor,
									group.subcategoryNames[project.subcategory_id || ''] ?? null
								)}
							{/each}
						</div>
					</div>
				{/each}

				{#if orphanProjects.length > 0}
					<div class="mt-1 border-t border-surface-border pt-1">
						<div class="px-4 py-1 text-[length:var(--text-label)] text-status-muted">Other</div>
						{#each orphanProjects as project (project.id)}
							{@render projectRow(project, '#6b7280', null)}
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.collapse-section {
		display: grid;
		grid-template-rows: 1fr;
		transition: grid-template-rows 200ms ease-out;
	}
	.collapse-section.collapsed {
		grid-template-rows: 0fr;
	}
	.collapse-section > div {
		overflow: hidden;
	}
</style>