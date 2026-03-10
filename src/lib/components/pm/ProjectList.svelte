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
	import { SvelteSet } from 'svelte/reactivity';
	import { formatStatusLabel, formatDueDate, getStatusPill, getPriorityTag } from './pm-utils.js';
	import { SURFACE, TEXT, SPACE, STATUS_COLORS, type StatusKey, getStatusColor } from '$lib/components/ui/design-tokens.js';

	interface Props {
		onselect?: (projectId: number) => void;
	}

	let { onselect }: Props = $props();

	let projectList = $state<Project[]>([]);
	let categoryList = $state<Category[]>([]);
	let subcategoryList = $state<Subcategory[]>([]);
	let loading = $state(false);
	let filterMode = $state<'active' | 'all' | 'done' | 'archived'>('active');
	let searchQuery = $state('');
	let collapsedCategories = new SvelteSet<string>();

	// New project modal state
	let showNewModal = $state(false);
	let newTitle = $state('');
	let newCategoryId = $state('');
	let newSubcategoryId = $state('');
	let newStatus = $state('todo');
	let newPriority = $state('medium');
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
	});

	/** Project list grouped by category */
	interface CategoryGroup {
		category: Category;
		projects: Project[];
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

		for (const p of filtered) {
			if (!projectsByCategory[p.category_id]) {
				projectsByCategory[p.category_id] = [];
			}
			projectsByCategory[p.category_id].push(p);
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
					projectCount: projs.length
				});
			}
		}

		return result;
	});

	function toggleCategory(categoryId: string) {
		if (collapsedCategories.has(categoryId)) {
			collapsedCategories.delete(categoryId);
		} else {
			collapsedCategories.add(categoryId);
		}
	}

	function resetNewForm() {
		newTitle = '';
		newCategoryId = '';
		newSubcategoryId = '';
		newStatus = 'todo';
		newPriority = 'medium';
		newDueDate = '';
		newDescription = '';
		showNewModal = false;
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
			resetNewForm();
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
		{ value: 'todo', label: 'Active' },
		{ value: 'in_progress', label: 'Active' },
		{ value: 'review', label: 'On Hold' },
		{ value: 'done', label: 'Done' },
		{ value: 'cancelled', label: 'Archived' },
		{ value: 'archived', label: 'Archived' }
	];

	const priorityOptions = [
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
		{ value: 'urgent', label: 'Urgent' }
	];

	function getSubcategoryName(subcategoryId: string | null): string | null {
		if (!subcategoryId) return null;
		const sub = subcategoryList.find((s) => s.id === subcategoryId);
		return sub?.name || null;
	}
</script>

<div class="flex h-full flex-col">
	{#if loading}
		<div class="flex flex-1 items-center justify-center {TEXT.body} text-status-muted">
			Loading...
		</div>
	{:else}
		<!-- Toolbar -->
		<div class="flex-shrink-0 p-4 {SURFACE.border} border-b bg-surface-2">
			<div class="flex flex-wrap gap-3 items-center justify-between">
				<!-- Filter pills on left -->
				<div class="flex gap-2">
					{#each filters as f (f.key)}
						<button
							class="px-3 py-1.5 rounded-lg {TEXT.badge} font-medium transition-colors {filterMode === f.key
								? 'bg-status-info text-white'
								: 'text-status-muted hover:bg-surface-3'}"
							onclick={() => {
								filterMode = f.key;
							}}
						>
							{f.label}
						</button>
					{/each}
				</div>

				<!-- Search input + New Project button on right -->
				<div class="flex gap-3 items-center">
					<div class="relative">
						<input
							type="text"
							placeholder="Search projects..."
							bind:value={searchQuery}
							class="pl-9 pr-4 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info w-64"
						/>
						<svg
							class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-status-muted"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<circle cx="11" cy="11" r="8"></circle>
							<path d="m21 21-4.35-4.35"></path>
						</svg>
					</div>
					<button
						onclick={() => (showNewModal = true)}
						class="px-4 py-2 bg-status-info hover:bg-status-info/80 rounded-lg {TEXT.body} font-medium flex items-center gap-2 transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
						</svg>
						New Project
					</button>
				</div>
			</div>
		</div>

		<!-- Projects List -->
		<div class="flex-1 overflow-auto custom-scrollbar p-4 space-y-4">
			{#if grouped.length === 0}
				<div class="text-center text-status-muted py-12">
					<p>No projects yet. Create your first project to get started!</p>
				</div>
			{:else}
				{#each grouped as group (group.category.id)}
					{@const accentColor = group.category.color || '#6366f1'}
					{@const isCollapsed = collapsedCategories.has(group.category.id)}

					<!-- Category section -->
					<div class="bg-surface-2 rounded-xl overflow-hidden">
						<!-- Category header -->
						<button
							onclick={() => toggleCategory(group.category.id)}
							class="w-full flex items-center justify-between p-4 hover:bg-surface-3 transition-colors"
						>
							<div class="flex items-center gap-3">
								<div class="w-3 h-3 rounded-full" style="background: {accentColor}"></div>
								<span class="font-semibold">{group.category.name}</span>
								<span class="{TEXT.body} text-status-muted">({group.projectCount})</span>
							</div>
							<svg
								class="w-5 h-5 text-status-muted transition-transform {isCollapsed
									? ''
									: 'rotate-180'}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>

						{#if !isCollapsed}
							<div class="border-t {SURFACE.border}">
								{#each group.projects as project (project.id)}
									{@const subcategoryName = getSubcategoryName(project.subcategory_id)}
									{@const statusPill = getStatusPill(project.status)}
									{@const priorityTag = getPriorityTag(project.priority)}
									{@const due = formatDueDate(project.due_date)}

									<button
										onclick={() => onselect?.(project.id)}
										class="w-full p-4 border-b {SURFACE.border} last:border-b-0 hover:bg-surface-3 cursor-pointer transition-colors text-left"
									>
										<div class="flex items-start justify-between gap-4">
											<div class="flex-1 min-w-0">
												<h4 class="font-medium text-white truncate">{project.title}</h4>
												{#if subcategoryName}
													<div class="{TEXT.label} text-status-muted">{subcategoryName}</div>
												{/if}
											</div>
											<div class="flex items-center gap-2 flex-shrink-0">
												<span class="px-2 py-0.5 rounded {TEXT.badge} font-medium {statusPill.classes}">
													{statusPill.label}
												</span>
												{#if priorityTag}
													<span class="px-2 py-0.5 rounded {TEXT.badge} font-medium {priorityTag.classes}">
														{priorityTag.label}
													</span>
												{/if}
												{#if due}
													<span class="{TEXT.badge} {due.color}">{due.text}</span>
												{/if}
											</div>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<!-- New Project Modal -->
{#if showNewModal}
	<div class="fixed inset-0 bg-black/60 z-40"></div>
	<div class="fixed inset-0 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-2 rounded-xl w-full max-w-lg max-h-[90%] overflow-auto">
			<div class="p-6">
				<h3 class="{TEXT.pageTitle} mb-6">New Project</h3>
				<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleCreateProject(); }}>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Category *</label>
						<select
							bind:value={newCategoryId}
							required
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						>
							<option value="">Select category</option>
							{#each categoryList as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Subcategory</label>
						<select
							bind:value={newSubcategoryId}
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						>
							<option value="">None</option>
							{#each availableSubcategories as subcategory (subcategory.id)}
								<option value={subcategory.id}>{subcategory.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Title *</label>
						<input
							type="text"
							bind:value={newTitle}
							required
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="block {TEXT.label} font-medium text-status-muted mb-1">Status</label>
							<select
								bind:value={newStatus}
								class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
							>
								{#each statusOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="block {TEXT.label} font-medium text-status-muted mb-1">Priority</label>
							<select
								bind:value={newPriority}
								class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
							>
								{#each priorityOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					</div>

					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Due Date</label>
						<input
							type="date"
							bind:value={newDueDate}
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						/>
					</div>

					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Description</label>
						<textarea
							bind:value={newDescription}
							rows="3"
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info resize-none"
						></textarea>
					</div>

					<div class="flex justify-end gap-3 pt-4">
						<button
							type="button"
							onclick={resetNewForm}
							class="px-4 py-2 text-status-muted hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-4 py-2 bg-status-info hover:bg-status-info/80 rounded-lg font-medium transition-colors"
						>
							Save Project
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgb(30 41 59);
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgb(71 85 105);
		border-radius: 3px;
	}
</style>