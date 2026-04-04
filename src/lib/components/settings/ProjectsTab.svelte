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
		type Subcategory
	} from '$lib/stores/pm-categories.js';
	import { projects, loadProjects, type Project } from '$lib/stores/pm-projects.js';
	import { SURFACE, TEXT } from '$lib/components/ui/design-tokens.js';

	let categoryList = $state<Category[]>([]);
	let subcategoryList = $state<Subcategory[]>([]);
	let projectList = $state<Project[]>([]);

	// Category state
	let showCategoryModal = $state(false);
	let editingCategoryId = $state<string | null>(null);
	let categoryName = $state('');
	let categoryColor = $state('#6366f1');

	// Subcategory state
	let selectedCategoryId = $state('');
	let showSubcategoryModal = $state(false);
	let editingSubcategoryId = $state<string | null>(null);
	let subcategoryName = $state('');

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteType = $state<'category' | 'subcategory'>('category');
	let deleteTargetId = $state<string | null>(null);

	const colorPresets = [
		'#6366f1', // indigo
		'#ec4899', // pink
		'#10b981', // emerald
		'#f59e0b', // amber
		'#3b82f6', // blue
		'#8b5cf6', // violet
		'#ef4444', // red
		'#14b8a6' // teal
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

	function generateId(name: string): string {
		const id = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		if (!id) throw new Error('Name must contain at least one letter or number');
		return id;
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
	function openCategoryModal(categoryId?: string) {
		const category = categoryId ? categoryList.find((c) => c.id === categoryId) : null;
		editingCategoryId = categoryId || null;
		categoryName = category?.name || '';
		categoryColor = category?.color || '#6366f1';
		showCategoryModal = true;
	}

	function resetCategoryModal() {
		showCategoryModal = false;
		editingCategoryId = null;
		categoryName = '';
		categoryColor = '#6366f1';
	}

	async function saveCategory() {
		if (!categoryName.trim()) return;

		try {
			if (editingCategoryId) {
				await updateCategory(editingCategoryId, {
					name: categoryName.trim(),
					color: categoryColor
				});
			} else {
				await createCategory({
					id: generateId(categoryName),
					name: categoryName.trim(),
					color: categoryColor
				});
			}
			resetCategoryModal();
		} catch (err) {
			console.error('Failed to save category:', err);
		}
	}

	async function moveCategoryUp(categoryId: string) {
		const idx = categoryList.findIndex((c) => c.id === categoryId);
		if (idx <= 0) return;

		const ids = categoryList.map((c) => c.id);
		[ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
		await reorderCategories(ids);
	}

	async function moveCategoryDown(categoryId: string) {
		const idx = categoryList.findIndex((c) => c.id === categoryId);
		if (idx >= categoryList.length - 1) return;

		const ids = categoryList.map((c) => c.id);
		[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
		await reorderCategories(ids);
	}

	// Subcategory functions
	const filteredSubcategories = $derived.by(() => {
		if (!selectedCategoryId) return [];
		return subcategoryList.filter((s) => s.category_id === selectedCategoryId);
	});

	function openSubcategoryModal(subcategoryId?: string) {
		const subcategory = subcategoryId ? subcategoryList.find((s) => s.id === subcategoryId) : null;
		editingSubcategoryId = subcategoryId || null;
		subcategoryName = subcategory?.name || '';
		showSubcategoryModal = true;
	}

	function resetSubcategoryModal() {
		showSubcategoryModal = false;
		editingSubcategoryId = null;
		subcategoryName = '';
	}

	async function saveSubcategory() {
		if (!subcategoryName.trim() || !selectedCategoryId) return;

		try {
			if (editingSubcategoryId) {
				await updateSubcategory(editingSubcategoryId, {
					name: subcategoryName.trim()
				});
			} else {
				await createSubcategory({
					id: generateId(subcategoryName),
					category_id: selectedCategoryId,
					name: subcategoryName.trim()
				});
			}
			resetSubcategoryModal();
		} catch (err) {
			console.error('Failed to save subcategory:', err);
		}
	}

	async function moveSubcategoryUp(subcategoryId: string) {
		const filtered = filteredSubcategories;
		const idx = filtered.findIndex((s) => s.id === subcategoryId);
		if (idx <= 0) return;

		const ids = filtered.map((s) => s.id);
		[ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
		await reorderSubcategories(ids);
	}

	async function moveSubcategoryDown(subcategoryId: string) {
		const filtered = filteredSubcategories;
		const idx = filtered.findIndex((s) => s.id === subcategoryId);
		if (idx >= filtered.length - 1) return;

		const ids = filtered.map((s) => s.id);
		[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
		await reorderSubcategories(ids);
	}

	function confirmDelete(type: 'category' | 'subcategory', targetId: string) {
		deleteType = type;
		deleteTargetId = targetId;
		showDeleteConfirm = true;
	}

	async function executeDelete() {
		if (!deleteTargetId) return;

		try {
			if (deleteType === 'category') {
				await deleteCategory(deleteTargetId);
			} else {
				await deleteSubcategory(deleteTargetId);
			}
			showDeleteConfirm = false;
		} catch (err) {
			console.error('Failed to delete:', err);
		}
	}
</script>

<div class="p-6">
	<h2 class="{TEXT.pageTitle} mb-6">Settings</h2>
	<div class="grid md:grid-cols-2 gap-6">
		<!-- Categories -->
		<div class="bg-surface-2 rounded-xl p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="{TEXT.cardTitle} font-semibold">Categories</h3>
				<button
					onclick={() => openCategoryModal()}
					class="p-2 hover:bg-surface-3 rounded-lg transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
						></path>
					</svg>
				</button>
			</div>
			<div class="space-y-2">
				{#if categoryList.length === 0}
					<p class="text-status-muted {TEXT.body}">No categories yet.</p>
				{:else}
					{#each categoryList as category, idx (category.id)}
						{@const projectCount = getProjectCount(category.id)}
						<div class="flex items-center gap-2 p-2 bg-surface-3 rounded-lg group">
							<div
								class="w-3 h-3 rounded-full flex-shrink-0"
								style="background: {category.color}"
							></div>
							<span class="flex-1 truncate">{category.name}</span>
							<span class="{TEXT.badge} text-status-muted">{projectCount}</span>
							<div
								class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								{#if idx > 0}
									<button
										onclick={() => moveCategoryUp(category.id)}
										class="p-1 hover:bg-surface-2 rounded"
									>
										<svg
											class="w-4 h-4 text-status-muted"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 15l7-7 7 7"
											></path>
										</svg>
									</button>
								{/if}
								{#if idx < categoryList.length - 1}
									<button
										onclick={() => moveCategoryDown(category.id)}
										class="p-1 hover:bg-surface-2 rounded"
									>
										<svg
											class="w-4 h-4 text-status-muted"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 9l-7 7-7-7"
											></path>
										</svg>
									</button>
								{/if}
								<button
									onclick={() => openCategoryModal(category.id)}
									class="p-1 hover:bg-surface-2 rounded"
								>
									<svg
										class="w-4 h-4 text-status-muted"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										></path>
									</svg>
								</button>
								<button
									onclick={() => confirmDelete('category', category.id)}
									class="p-1 hover:bg-surface-2 rounded"
								>
									<svg
										class="w-4 h-4 text-status-muted"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										></path>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Subcategories -->
		<div class="bg-surface-2 rounded-xl p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="{TEXT.cardTitle} font-semibold">Subcategories</h3>
				<button
					onclick={() => openSubcategoryModal()}
					disabled={!selectedCategoryId}
					class="p-2 hover:bg-surface-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
						></path>
					</svg>
				</button>
			</div>
			<div class="mb-4">
				<select
					bind:value={selectedCategoryId}
					class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
				>
					<option value="">Select a category first</option>
					{#each categoryList as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-2">
				{#if !selectedCategoryId}
					<p class="text-status-muted {TEXT.body}">
						Select a category to manage its subcategories.
					</p>
				{:else if filteredSubcategories.length === 0}
					<p class="text-status-muted {TEXT.body}">No subcategories yet.</p>
				{:else}
					{#each filteredSubcategories as subcategory, idx (subcategory.id)}
						{@const projectCount = getProjectCount(selectedCategoryId, subcategory.id)}
						<div class="flex items-center gap-2 p-2 bg-surface-3 rounded-lg group">
							<span class="flex-1 truncate">{subcategory.name}</span>
							<span class="{TEXT.badge} text-status-muted">{projectCount}</span>
							<div
								class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								{#if idx > 0}
									<button
										onclick={() => moveSubcategoryUp(subcategory.id)}
										class="p-1 hover:bg-surface-2 rounded"
									>
										<svg
											class="w-4 h-4 text-status-muted"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 15l7-7 7 7"
											></path>
										</svg>
									</button>
								{/if}
								{#if idx < filteredSubcategories.length - 1}
									<button
										onclick={() => moveSubcategoryDown(subcategory.id)}
										class="p-1 hover:bg-surface-2 rounded"
									>
										<svg
											class="w-4 h-4 text-status-muted"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 9l-7 7-7-7"
											></path>
										</svg>
									</button>
								{/if}
								<button
									onclick={() => openSubcategoryModal(subcategory.id)}
									class="p-1 hover:bg-surface-2 rounded"
								>
									<svg
										class="w-4 h-4 text-status-muted"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										></path>
									</svg>
								</button>
								<button
									onclick={() => confirmDelete('subcategory', subcategory.id)}
									class="p-1 hover:bg-surface-2 rounded"
								>
									<svg
										class="w-4 h-4 text-status-muted"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										></path>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Category Modal -->
{#if showCategoryModal}
	<div class="fixed inset-0 bg-black/60 z-40"></div>
	<div class="fixed inset-0 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-2 rounded-xl w-full max-w-md">
			<div class="p-6">
				<h3 class="{TEXT.pageTitle} mb-6">
					{editingCategoryId ? 'Edit Category' : 'New Category'}
				</h3>
				<form
					class="space-y-4"
					onsubmit={(e) => {
						e.preventDefault();
						saveCategory();
					}}
				>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Name *</label>
						<input
							type="text"
							bind:value={categoryName}
							required
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						/>
					</div>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Color</label>
						<div class="flex gap-2 flex-wrap">
							{#each colorPresets as color (color)}
								<button
									type="button"
									onclick={() => (categoryColor = color)}
									class="w-8 h-8 rounded-lg {categoryColor === color
										? 'ring-2 ring-white ring-offset-2 ring-offset-surface-2'
										: ''}"
									style="background: {color}"
								></button>
							{/each}
						</div>
					</div>
					<div class="flex justify-end gap-3 pt-4">
						<button
							type="button"
							onclick={resetCategoryModal}
							class="px-4 py-2 text-status-muted hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-4 py-2 bg-status-info hover:bg-status-info/80 rounded-lg font-medium transition-colors"
						>
							Save
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Subcategory Modal -->
{#if showSubcategoryModal}
	<div class="fixed inset-0 bg-black/60 z-40"></div>
	<div class="fixed inset-0 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-2 rounded-xl w-full max-w-md">
			<div class="p-6">
				<h3 class="{TEXT.pageTitle} mb-6">
					{editingSubcategoryId ? 'Edit Subcategory' : 'New Subcategory'}
				</h3>
				<form
					class="space-y-4"
					onsubmit={(e) => {
						e.preventDefault();
						saveSubcategory();
					}}
				>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Name *</label>
						<input
							type="text"
							bind:value={subcategoryName}
							required
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						/>
					</div>
					<div class="flex justify-end gap-3 pt-4">
						<button
							type="button"
							onclick={resetSubcategoryModal}
							class="px-4 py-2 text-status-muted hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-4 py-2 bg-status-info hover:bg-status-info/80 rounded-lg font-medium transition-colors"
						>
							Save
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Confirm Delete Modal -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 bg-black/60 z-40"></div>
	<div class="fixed inset-0 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-2 rounded-xl w-full max-w-md">
			<div class="p-6">
				<h3 class="{TEXT.pageTitle} mb-4">Confirm Delete</h3>
				<p class="{TEXT.body} text-status-muted mb-6">
					{#if deleteType === 'category'}
						Are you sure you want to delete this category? Projects using this category will lose
						their category assignment.
					{:else}
						Are you sure you want to delete this subcategory? Projects using this subcategory will
						lose their subcategory assignment.
					{/if}
				</p>
				<div class="flex justify-end gap-3">
					<button
						onclick={() => (showDeleteConfirm = false)}
						class="px-4 py-2 text-status-muted hover:text-white transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={executeDelete}
						class="px-4 py-2 bg-status-danger hover:bg-status-danger/80 rounded-lg font-medium transition-colors"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
