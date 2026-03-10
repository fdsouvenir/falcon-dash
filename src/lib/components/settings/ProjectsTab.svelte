<script lang="ts">
	import {
		categories,
		subcategories,
		loadCategories,
		loadSubcategories,
		createCategory,
		updateCategory,
		deleteCategory,
		reorderCategories,
		createSubcategory,
		updateSubcategory,
		deleteSubcategory,
		reorderSubcategories,
		type Category,
		type Subcategory,
		getSubcategoriesByCategory
	} from '$lib/stores/pm-categories.js';
	import { projects, loadProjects, type Project } from '$lib/stores/pm-projects.js';

	let categoryList = $state<Category[]>([]);
	let subcategoryList = $state<Subcategory[]>([]);
	let projectList = $state<Project[]>([]);

	// Category state
	let showNewCategory = $state(false);
	let newCategoryName = $state('');
	let newCategoryDescription = $state('');
	let newCategoryColor = $state('#60a5fa');
	let editingCategory = $state<string | null>(null);
	let editCategoryData = $state<Partial<Category>>({});

	// Subcategory state
	let selectedCategoryId = $state('');
	let showNewSubcategory = $state(false);
	let newSubcategoryName = $state('');
	let newSubcategoryDescription = $state('');
	let editingSubcategory = $state<string | null>(null);
	let editSubcategoryData = $state<Partial<Subcategory>>({});

	const colorPresets = [
		'#60a5fa', // blue
		'#a78bfa', // purple
		'#34d399', // green
		'#fb923c', // orange
		'#f87171', // red
		'#fbbf24', // yellow
		'#06b6d4', // cyan
		'#ec4899', // pink
		'#8b5cf6', // violet
		'#10b981'  // emerald
	];

	$effect(() => {
		const u1 = categories.subscribe((v) => {
			categoryList = v;
		});
		const u2 = subcategories.subscribe((v) => {
			subcategoryList = v;
		});
		const u3 = projects.subscribe((v) => {
			projectList = v;
		});
		return () => {
			u1();
			u2();
			u3();
		};
	});

	$effect(() => {
		loadCategories();
		loadSubcategories();
		loadProjects();
	});

	// Helper functions
	function generateId(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function getProjectCount(categoryId: string, subcategoryId?: string): number {
		return projectList.filter((p) => {
			if (subcategoryId) {
				return p.category_id === categoryId && p.subcategory_id === subcategoryId;
			}
			return p.category_id === categoryId;
		}).length;
	}

	// Category functions
	async function handleCreateCategory() {
		if (!newCategoryName.trim()) return;
		try {
			await createCategory({
				id: generateId(newCategoryName),
				name: newCategoryName.trim(),
				description: newCategoryDescription.trim() || undefined,
				color: newCategoryColor
			});
			resetCategoryForm();
		} catch (err) {
			console.error('Failed to create category:', err);
		}
	}

	function resetCategoryForm() {
		newCategoryName = '';
		newCategoryDescription = '';
		newCategoryColor = '#60a5fa';
		showNewCategory = false;
	}

	function startEditCategory(category: Category) {
		editingCategory = category.id;
		editCategoryData = {
			name: category.name,
			description: category.description || '',
			color: category.color || '#60a5fa'
		};
	}

	async function handleUpdateCategory() {
		if (editingCategory === null || !editCategoryData.name?.trim()) return;
		try {
			await updateCategory(editingCategory, {
				name: editCategoryData.name.trim(),
				description: editCategoryData.description?.trim() || undefined,
				color: editCategoryData.color
			});
			editingCategory = null;
			editCategoryData = {};
		} catch (err) {
			console.error('Failed to update category:', err);
		}
	}

	async function handleDeleteCategory(categoryId: string) {
		const projectCount = getProjectCount(categoryId);
		if (projectCount > 0) {
			alert(`Cannot delete category: ${projectCount} projects are using it.`);
			return;
		}
		if (!confirm('Delete this category?')) return;
		try {
			await deleteCategory(categoryId);
		} catch (err) {
			console.error('Failed to delete category:', err);
		}
	}

	async function moveCategoryUp(index: number) {
		if (index === 0) return;
		const newOrder = [...categoryList];
		[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
		try {
			await reorderCategories(newOrder.map((c) => c.id));
		} catch (err) {
			console.error('Failed to reorder categories:', err);
		}
	}

	async function moveCategoryDown(index: number) {
		if (index === categoryList.length - 1) return;
		const newOrder = [...categoryList];
		[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
		try {
			await reorderCategories(newOrder.map((c) => c.id));
		} catch (err) {
			console.error('Failed to reorder categories:', err);
		}
	}

	// Subcategory functions
	const selectedCategorySubcategories = $derived.by(() => {
		if (!selectedCategoryId) return [];
		return getSubcategoriesByCategory(selectedCategoryId);
	});

	async function handleCreateSubcategory() {
		if (!newSubcategoryName.trim() || !selectedCategoryId) return;
		try {
			await createSubcategory({
				id: generateId(newSubcategoryName),
				category_id: selectedCategoryId,
				name: newSubcategoryName.trim(),
				description: newSubcategoryDescription.trim() || undefined
			});
			resetSubcategoryForm();
		} catch (err) {
			console.error('Failed to create subcategory:', err);
		}
	}

	function resetSubcategoryForm() {
		newSubcategoryName = '';
		newSubcategoryDescription = '';
		showNewSubcategory = false;
	}

	function startEditSubcategory(subcategory: Subcategory) {
		editingSubcategory = subcategory.id;
		editSubcategoryData = {
			name: subcategory.name,
			description: subcategory.description || ''
		};
	}

	async function handleUpdateSubcategory() {
		if (editingSubcategory === null || !editSubcategoryData.name?.trim()) return;
		try {
			await updateSubcategory(editingSubcategory, {
				name: editSubcategoryData.name.trim(),
				description: editSubcategoryData.description?.trim() || undefined
			});
			editingSubcategory = null;
			editSubcategoryData = {};
		} catch (err) {
			console.error('Failed to update subcategory:', err);
		}
	}

	async function handleDeleteSubcategory(subcategoryId: string, categoryId: string) {
		const projectCount = getProjectCount(categoryId, subcategoryId);
		if (projectCount > 0) {
			alert(`Cannot delete subcategory: ${projectCount} projects are using it.`);
			return;
		}
		if (!confirm('Delete this subcategory?')) return;
		try {
			await deleteSubcategory(subcategoryId);
		} catch (err) {
			console.error('Failed to delete subcategory:', err);
		}
	}

	async function moveSubcategoryUp(index: number) {
		if (index === 0) return;
		const newOrder = [...selectedCategorySubcategories];
		[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
		try {
			await reorderSubcategories(newOrder.map((s) => s.id));
		} catch (err) {
			console.error('Failed to reorder subcategories:', err);
		}
	}

	async function moveSubcategoryDown(index: number) {
		if (index === selectedCategorySubcategories.length - 1) return;
		const newOrder = [...selectedCategorySubcategories];
		[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
		try {
			await reorderSubcategories(newOrder.map((s) => s.id));
		} catch (err) {
			console.error('Failed to reorder subcategories:', err);
		}
	}
</script>

<div class="space-y-8">
	<!-- Categories Section -->
	<div>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-[length:var(--text-card-title)] font-semibold text-white">Categories</h2>
			<button
				onclick={() => (showNewCategory = !showNewCategory)}
				class="rounded-lg bg-status-active px-3 py-1.5 text-[length:var(--text-badge)] font-medium text-white hover:bg-status-active/80"
			>
				+ Add Category
			</button>
		</div>

		<!-- Add new category form -->
		{#if showNewCategory}
			<div class="mb-4 rounded-lg border border-surface-border bg-surface-2 p-4">
				<h3 class="mb-3 text-[length:var(--text-body)] font-medium text-white">New Category</h3>
				<div class="space-y-3">
					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Name *
						</label>
						<input
							type="text"
							bind:value={newCategoryName}
							placeholder="Category name"
							class="mt-1 w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
						/>
					</div>

					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Description
						</label>
						<input
							type="text"
							bind:value={newCategoryDescription}
							placeholder="Optional description"
							class="mt-1 w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
						/>
					</div>

					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Color
						</label>
						<div class="mt-2 flex gap-2">
							{#each colorPresets as color (color)}
								<button
									onclick={() => (newCategoryColor = color)}
									class="h-8 w-8 rounded border-2 {newCategoryColor === color
										? 'border-white'
										: 'border-surface-border'}"
									style="background-color: {color}"
									title={color}
								></button>
							{/each}
							<input
								type="color"
								bind:value={newCategoryColor}
								class="h-8 w-16 rounded border border-surface-border bg-surface-1"
							/>
						</div>
					</div>

					<div class="flex gap-2">
						<button
							onclick={handleCreateCategory}
							disabled={!newCategoryName.trim()}
							class="rounded bg-status-active px-3 py-2 text-[length:var(--text-badge)] font-medium text-white hover:bg-status-active/80 disabled:opacity-50"
						>
							Create
						</button>
						<button
							onclick={resetCategoryForm}
							class="rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-badge)] text-white hover:bg-surface-3"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Categories list -->
		<div class="space-y-2">
			{#each categoryList as category, index (category.id)}
				<div class="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-2 p-3">
					<!-- Color swatch -->
					<div
						class="h-4 w-4 rounded"
						style="background-color: {category.color || '#6b7280'}"
					></div>

					<!-- Category info -->
					<div class="flex-1">
						{#if editingCategory === category.id}
							<div class="space-y-2">
								<input
									type="text"
									bind:value={editCategoryData.name}
									class="w-full rounded border border-surface-border bg-surface-1 px-2 py-1 text-[length:var(--text-body)] font-medium text-white focus:border-status-info focus:outline-none"
								/>
								<input
									type="text"
									bind:value={editCategoryData.description}
									placeholder="Optional description"
									class="w-full rounded border border-surface-border bg-surface-1 px-2 py-1 text-[length:var(--text-label)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
								/>
								<div class="flex gap-1">
									{#each colorPresets as color (color)}
										<button
											onclick={() => (editCategoryData.color = color)}
											class="h-6 w-6 rounded border {editCategoryData.color === color
												? 'border-white'
												: 'border-surface-border'}"
											style="background-color: {color}"
										></button>
									{/each}
									<input
										type="color"
										bind:value={editCategoryData.color}
										class="h-6 w-12 rounded border border-surface-border bg-surface-1"
									/>
								</div>
								<div class="flex gap-2">
									<button
										onclick={handleUpdateCategory}
										class="rounded bg-status-active px-2 py-1 text-[length:var(--text-badge)] text-white hover:bg-status-active/80"
									>
										Save
									</button>
									<button
										onclick={() => {
											editingCategory = null;
											editCategoryData = {};
										}}
										class="rounded border border-surface-border bg-surface-1 px-2 py-1 text-[length:var(--text-badge)] text-white hover:bg-surface-3"
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<div>
								<div class="text-[length:var(--text-body)] font-medium text-white">
									{category.name}
									<span class="ml-2 text-[length:var(--text-label)] text-status-muted">
										({getProjectCount(category.id)} projects)
									</span>
								</div>
								{#if category.description}
									<div class="text-[length:var(--text-label)] text-status-muted">
										{category.description}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Actions -->
					{#if editingCategory !== category.id}
						<div class="flex shrink-0 gap-1">
							<!-- Move up -->
							<button
								onclick={() => moveCategoryUp(index)}
								disabled={index === 0}
								class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white disabled:opacity-30"
								title="Move up"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
								</svg>
							</button>

							<!-- Move down -->
							<button
								onclick={() => moveCategoryDown(index)}
								disabled={index === categoryList.length - 1}
								class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white disabled:opacity-30"
								title="Move down"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
								</svg>
							</button>

							<!-- Edit -->
							<button
								onclick={() => startEditCategory(category)}
								class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white"
								title="Edit"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									></path>
								</svg>
							</button>

							<!-- Delete -->
							<button
								onclick={() => handleDeleteCategory(category.id)}
								class="rounded p-1 text-status-danger hover:bg-status-danger-bg"
								title="Delete"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									></path>
								</svg>
							</button>
						</div>
					{/if}
				</div>
			{/each}

			{#if categoryList.length === 0}
				<div class="py-8 text-center text-[length:var(--text-body)] text-status-muted">
					No categories yet. Create one to organize your projects.
				</div>
			{/if}
		</div>
	</div>

	<!-- Subcategories Section -->
	<div>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-[length:var(--text-card-title)] font-semibold text-white">Subcategories</h2>
			<button
				onclick={() => (showNewSubcategory = !showNewSubcategory)}
				disabled={!selectedCategoryId}
				class="rounded-lg bg-status-active px-3 py-1.5 text-[length:var(--text-badge)] font-medium text-white hover:bg-status-active/80 disabled:opacity-50"
			>
				+ Add Subcategory
			</button>
		</div>

		<!-- Category filter -->
		<div class="mb-4">
			<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
				Filter by Category
			</label>
			<select
				bind:value={selectedCategoryId}
				class="mt-1 w-full rounded border border-surface-border bg-surface-2 px-3 py-2 text-[length:var(--text-body)] text-white focus:border-status-info focus:outline-none"
			>
				<option value="">Select a category</option>
				{#each categoryList as category (category.id)}
					<option value={category.id}>{category.name}</option>
				{/each}
			</select>
		</div>

		<!-- Add new subcategory form -->
		{#if showNewSubcategory && selectedCategoryId}
			<div class="mb-4 rounded-lg border border-surface-border bg-surface-2 p-4">
				<h3 class="mb-3 text-[length:var(--text-body)] font-medium text-white">
					New Subcategory
				</h3>
				<div class="space-y-3">
					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Name *
						</label>
						<input
							type="text"
							bind:value={newSubcategoryName}
							placeholder="Subcategory name"
							class="mt-1 w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
						/>
					</div>

					<div>
						<label class="block text-[length:var(--text-label)] font-medium text-status-muted">
							Description
						</label>
						<input
							type="text"
							bind:value={newSubcategoryDescription}
							placeholder="Optional description"
							class="mt-1 w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
						/>
					</div>

					<div class="flex gap-2">
						<button
							onclick={handleCreateSubcategory}
							disabled={!newSubcategoryName.trim()}
							class="rounded bg-status-active px-3 py-2 text-[length:var(--text-badge)] font-medium text-white hover:bg-status-active/80 disabled:opacity-50"
						>
							Create
						</button>
						<button
							onclick={resetSubcategoryForm}
							class="rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-badge)] text-white hover:bg-surface-3"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Subcategories list -->
		{#if selectedCategoryId}
			<div class="space-y-2">
				{#each selectedCategorySubcategories as subcategory, index (subcategory.id)}
					<div class="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-2 p-3">
						<!-- Subcategory info -->
						<div class="flex-1">
							{#if editingSubcategory === subcategory.id}
								<div class="space-y-2">
									<input
										type="text"
										bind:value={editSubcategoryData.name}
										class="w-full rounded border border-surface-border bg-surface-1 px-2 py-1 text-[length:var(--text-body)] font-medium text-white focus:border-status-info focus:outline-none"
									/>
									<input
										type="text"
										bind:value={editSubcategoryData.description}
										placeholder="Optional description"
										class="w-full rounded border border-surface-border bg-surface-1 px-2 py-1 text-[length:var(--text-label)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
									/>
									<div class="flex gap-2">
										<button
											onclick={handleUpdateSubcategory}
											class="rounded bg-status-active px-2 py-1 text-[length:var(--text-badge)] text-white hover:bg-status-active/80"
										>
											Save
										</button>
										<button
											onclick={() => {
												editingSubcategory = null;
												editSubcategoryData = {};
											}}
											class="rounded border border-surface-border bg-surface-1 px-2 py-1 text-[length:var(--text-badge)] text-white hover:bg-surface-3"
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<div>
									<div class="text-[length:var(--text-body)] font-medium text-white">
										{subcategory.name}
										<span class="ml-2 text-[length:var(--text-label)] text-status-muted">
											({getProjectCount(selectedCategoryId, subcategory.id)} projects)
										</span>
									</div>
									{#if subcategory.description}
										<div class="text-[length:var(--text-label)] text-status-muted">
											{subcategory.description}
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Actions -->
						{#if editingSubcategory !== subcategory.id}
							<div class="flex shrink-0 gap-1">
								<!-- Move up -->
								<button
									onclick={() => moveSubcategoryUp(index)}
									disabled={index === 0}
									class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white disabled:opacity-30"
									title="Move up"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
									</svg>
								</button>

								<!-- Move down -->
								<button
									onclick={() => moveSubcategoryDown(index)}
									disabled={index === selectedCategorySubcategories.length - 1}
									class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white disabled:opacity-30"
									title="Move down"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
									</svg>
								</button>

								<!-- Edit -->
								<button
									onclick={() => startEditSubcategory(subcategory)}
									class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white"
									title="Edit"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										></path>
									</svg>
								</button>

								<!-- Delete -->
								<button
									onclick={() => handleDeleteSubcategory(subcategory.id, selectedCategoryId)}
									class="rounded p-1 text-status-danger hover:bg-status-danger-bg"
									title="Delete"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										></path>
									</svg>
								</button>
							</div>
						{/if}
					</div>
				{/each}

				{#if selectedCategorySubcategories.length === 0}
					<div class="py-8 text-center text-[length:var(--text-body)] text-status-muted">
						No subcategories in this category yet.
					</div>
				{/if}
			</div>
		{:else}
			<div class="py-8 text-center text-[length:var(--text-body)] text-status-muted">
				Select a category to view its subcategories.
			</div>
		{/if}
	</div>
</div>