<script lang="ts">
	import {
		Folder,
		FolderPlus,
		Layers,
		ListTree,
		Plus,
		RefreshCw,
		Save,
		Trash2
	} from '@lucide/svelte';
	import type { WorkCategory } from '$lib/work/work-ui.js';

	type CategoryResponse = {
		categories: WorkCategory[];
		subcategories: WorkCategory[];
		all: WorkCategory[];
	};

	type DrawerMode = 'new_category' | 'new_subcategory' | 'edit_category' | 'edit_subcategory';

	type Draft = {
		title: string;
		description: string;
		parent_category_id: string;
	};

	const emptyDraft = (): Draft => ({
		title: '',
		description: '',
		parent_category_id: ''
	});

	let loading = $state(true);
	let saving = $state(false);
	let initialized = $state(false);
	let error = $state<string | null>(null);
	let saveMessage = $state<string | null>(null);
	let categories = $state<WorkCategory[]>([]);
	let subcategories = $state<WorkCategory[]>([]);
	let selectedCategoryId = $state('');
	let selectedSubcategoryId = $state('');
	let drawerMode = $state<DrawerMode>('new_category');
	let draft = $state<Draft>(emptyDraft());

	const parentCategoryOptions = $derived(categories);
	const selectedCategory = $derived(
		categories.find((category) => category.id === selectedCategoryId) ?? null
	);
	const selectedSubcategory = $derived(
		subcategories.find((subcategory) => subcategory.id === selectedSubcategoryId) ?? null
	);
	const drawerIsCategory = $derived(
		drawerMode === 'new_category' || drawerMode === 'edit_category'
	);
	const drawerTitle = $derived(
		drawerMode === 'new_category'
			? 'New category'
			: drawerMode === 'new_subcategory'
				? 'New subcategory'
				: drawerMode === 'edit_category'
					? 'Edit category'
					: 'Edit subcategory'
	);
	const drawerEyebrow = $derived(
		drawerIsCategory
			? 'Top-level bucket'
			: selectedCategory
				? `${selectedCategory.title} / Subcategory`
				: 'Nested group'
	);

	$effect(() => {
		void loadSettings();
	});

	async function loadSettings() {
		loading = true;
		error = null;
		try {
			const categoryResponse = await fetch('/api/work/categories');
			if (!categoryResponse.ok)
				throw new Error(`Category request failed: ${categoryResponse.status}`);

			const categoryData = (await categoryResponse.json()) as CategoryResponse;
			const nextCategories = categoryData.categories ?? [];
			const nextSubcategories = categoryData.subcategories ?? [];

			categories = nextCategories;
			subcategories = nextSubcategories;

			if (!initialized) {
				openNewCategory();
				initialized = true;
			} else {
				repairSelection(nextCategories, nextSubcategories);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load categories';
		} finally {
			loading = false;
		}
	}

	function repairSelection(nextCategories: WorkCategory[], nextSubcategories: WorkCategory[]) {
		if (
			selectedCategoryId &&
			!nextCategories.some((category) => category.id === selectedCategoryId)
		) {
			openNewCategory();
			return;
		}
		if (
			selectedSubcategoryId &&
			!nextSubcategories.some((subcategory) => subcategory.id === selectedSubcategoryId)
		) {
			openNewSubcategory(selectedCategoryId);
		}
		if (drawerMode === 'new_subcategory' && !draft.parent_category_id) {
			draft.parent_category_id = selectedCategoryId || categories[0]?.id || '';
		}
	}

	function draftFromCategory(category: WorkCategory): Draft {
		return {
			title: category.title,
			description: category.description ?? '',
			parent_category_id: category.parent_category_id ?? ''
		};
	}

	function openNewCategory() {
		drawerMode = 'new_category';
		selectedCategoryId = '';
		selectedSubcategoryId = '';
		draft = emptyDraft();
		saveMessage = null;
	}

	function openNewSubcategory(categoryId = selectedCategoryId) {
		const parentId = categoryId || categories[0]?.id || '';
		drawerMode = 'new_subcategory';
		selectedCategoryId = parentId;
		selectedSubcategoryId = '';
		draft = {
			...emptyDraft(),
			parent_category_id: parentId
		};
		saveMessage = null;
	}

	function selectCategory(category: WorkCategory) {
		selectedCategoryId = category.id;
		selectedSubcategoryId = '';
		drawerMode = 'edit_category';
		draft = draftFromCategory(category);
		saveMessage = null;
	}

	function selectSubcategory(category: WorkCategory, subcategory: WorkCategory) {
		selectedCategoryId = category.id;
		selectedSubcategoryId = subcategory.id;
		drawerMode = 'edit_subcategory';
		draft = draftFromCategory(subcategory);
		saveMessage = null;
	}

	function toggleCategory(category: WorkCategory) {
		if (selectedCategoryId === category.id && !selectedSubcategoryId) {
			openNewCategory();
			return;
		}
		selectCategory(category);
	}

	function toggleSubcategory(category: WorkCategory, subcategory: WorkCategory) {
		if (selectedSubcategoryId === subcategory.id) {
			openNewSubcategory(category.id);
			return;
		}
		selectSubcategory(category, subcategory);
	}

	async function submitDrawer(event: SubmitEvent) {
		event.preventDefault();
		const isCategory = drawerMode === 'new_category' || drawerMode === 'edit_category';
		const id =
			drawerMode === 'edit_category'
				? selectedCategoryId
				: drawerMode === 'edit_subcategory'
					? selectedSubcategoryId
					: undefined;
		const saved = await saveCategory(
			{
				kind: isCategory ? 'category' : 'subcategory',
				title: draft.title.trim(),
				description: draft.description.trim(),
				parent_category_id: isCategory ? null : draft.parent_category_id
			},
			id
		);
		if (!saved) return;
		if (saved.kind === 'category') {
			selectCategory(saved);
		} else {
			const parent = categories.find((category) => category.id === saved.parent_category_id);
			if (parent) selectSubcategory(parent, saved);
		}
	}

	async function deleteSelected() {
		const id = drawerMode === 'edit_category' ? selectedCategoryId : selectedSubcategoryId;
		if (!id) return;
		const wasSubcategory = drawerMode === 'edit_subcategory';
		const parentId = selectedSubcategory?.parent_category_id ?? selectedCategoryId;
		saving = true;
		error = null;
		saveMessage = null;
		try {
			const response = await fetch(`/api/work/categories/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.error ?? `Delete failed: ${response.status}`);
			}
			saveMessage = 'Deleted';
			await loadSettings();
			if (wasSubcategory && categories.some((category) => category.id === parentId)) {
				openNewSubcategory(parentId);
			} else {
				openNewCategory();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to delete category';
		} finally {
			saving = false;
		}
	}

	async function saveCategory(
		payload: Partial<WorkCategory>,
		id?: string
	): Promise<WorkCategory | null> {
		saving = true;
		error = null;
		saveMessage = null;
		try {
			const response = await fetch(
				id ? `/api/work/categories/${encodeURIComponent(id)}` : '/api/work/categories',
				{
					method: id ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}
			);
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.error ?? `Save failed: ${response.status}`);
			}
			const saved = (await response.json()) as WorkCategory;
			saveMessage = id ? 'Saved changes' : 'Created';
			await loadSettings();
			return saved;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to save category';
			return null;
		} finally {
			saving = false;
		}
	}

	function childrenFor(category: WorkCategory): WorkCategory[] {
		return subcategories.filter((subcategory) => subcategory.parent_category_id === category.id);
	}

	function categorySectionClass(category: WorkCategory): string {
		const isSelectedCategory = selectedCategoryId === category.id && !selectedSubcategoryId;
		const containsSelection = selectedCategoryId === category.id;
		if (isSelectedCategory) {
			return 'border-primary/45 bg-primary/10 shadow-[0_16px_34px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(138,209,239,0.2)]';
		}
		if (containsSelection) {
			return 'border-primary/25 bg-primary/5 shadow-[0_12px_28px_rgba(0,0,0,0.16)]';
		}
		return 'border-outline-variant/45 bg-surface-1 shadow-[0_10px_24px_rgba(0,0,0,0.12)]';
	}

	function categoryButtonClass(category: WorkCategory): string {
		if (selectedCategoryId === category.id && !selectedSubcategoryId) {
			return 'bg-primary/10 ring-1 ring-inset ring-primary/35';
		}
		return 'hover:bg-surface-2/60';
	}

	function subcategoryButtonClass(subcategory: WorkCategory): string {
		if (selectedSubcategoryId === subcategory.id) {
			return 'bg-primary/15 ring-1 ring-inset ring-primary/45 shadow-[0_8px_20px_rgba(0,0,0,0.18)]';
		}
		return 'bg-surface-0/45 hover:bg-surface-2/55';
	}

	function hasEditableSelection(): boolean {
		return drawerMode === 'edit_category' || drawerMode === 'edit_subcategory';
	}

	function selectedLabel(): string {
		if (drawerMode === 'edit_category') return selectedCategory?.title ?? 'Selected category';
		if (drawerMode === 'edit_subcategory') {
			return selectedSubcategory?.title ?? 'Selected subcategory';
		}
		if (drawerMode === 'new_subcategory') return selectedCategory?.title ?? 'Selected category';
		return 'New top-level category';
	}
</script>

<section class="space-y-4" data-testid="work-settings">
	<div
		class="overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
	>
		<div
			class="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/35 bg-surface-2/45 px-4 py-4 sm:px-5"
		>
			<div class="min-w-0">
				<div
					class="flex flex-wrap items-center gap-2 text-xs font-semibold text-on-surface-variant"
				>
					<Layers class="h-4 w-4 text-primary" />
					Categories and subcategories
				</div>
				<h2 class="mt-2 text-2xl font-semibold text-on-surface">Work settings</h2>
				<p class="mt-1 max-w-2xl text-sm text-on-surface-variant">
					Use categories for broad buckets, then add subcategories for the smaller groups inside
					them.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={loadSettings}
					class="falcon-focus inline-flex min-h-10 items-center gap-2 rounded-md border border-outline-variant/65 bg-surface-1 px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2"
				>
					<RefreshCw class="h-4 w-4" />
					Refresh
				</button>
				<button
					type="button"
					onclick={openNewCategory}
					data-testid="work-settings-add-category"
					class="falcon-focus inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
				>
					<FolderPlus class="h-4 w-4" />
					Add category
				</button>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_30rem]">
			<div class="rounded-lg border border-outline-variant/45 bg-surface-1 p-5">
				<p class="text-sm text-on-surface-variant">Loading settings...</p>
			</div>
			<div class="rounded-lg border border-outline-variant/45 bg-surface-1 p-5">
				<p class="text-sm text-on-surface-variant">Preparing editor...</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-start">
			<div
				class="overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.16)]"
			>
				<div
					class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/35 bg-surface-2/35 px-4 py-3"
				>
					<div class="flex items-center gap-2">
						<ListTree class="h-4 w-4 text-primary" />
						<h3 class="text-sm font-semibold text-on-surface">Category directory</h3>
					</div>
					<span class="text-xs text-on-surface-variant">Select a row, edit on the right</span>
				</div>

				<div class="space-y-3 bg-surface-0/35 p-3" data-testid="work-settings-directory">
					{#each categories as category (category.id)}
						{@const children = childrenFor(category)}
						<section
							class="overflow-hidden rounded-lg border transition {categorySectionClass(category)}"
						>
							<div class="px-3 pt-3">
								<button
									type="button"
									onclick={() => toggleCategory(category)}
									aria-pressed={selectedCategoryId === category.id && !selectedSubcategoryId}
									class="falcon-focus group w-full min-w-0 rounded-md text-left transition {categoryButtonClass(
										category
									)}"
									data-testid="work-settings-category-row"
								>
									<div class="flex min-w-0 items-start gap-3 p-2">
										<span
											class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition {selectedCategoryId ===
												category.id && !selectedSubcategoryId
												? 'bg-primary text-primary-foreground'
												: 'bg-surface-2 text-primary'}"
										>
											<Folder class="h-4 w-4" />
										</span>
										<span class="min-w-0 flex-1">
											<span class="block truncate text-base font-semibold text-on-surface">
												{category.title}
											</span>
											<span class="mt-1 block text-sm text-on-surface-variant">
												{category.description || 'No notes yet.'}
											</span>
										</span>
									</div>
								</button>
							</div>

							<div class="px-3 pb-3 pt-2">
								{#if children.length > 0}
									<div class="space-y-1.5 rounded-lg bg-surface-0/55 p-1.5">
										{#each children as subcategory (subcategory.id)}
											<button
												type="button"
												onclick={() => toggleSubcategory(category, subcategory)}
												aria-pressed={selectedSubcategoryId === subcategory.id}
												class="falcon-focus group w-full rounded-md px-3 py-3 text-left transition {subcategoryButtonClass(
													subcategory
												)}"
												data-testid="work-settings-subcategory-row"
											>
												<span class="flex min-w-0 items-center gap-3">
													<span
														class="h-2.5 w-2.5 shrink-0 rounded-full bg-primary {selectedSubcategoryId ===
														subcategory.id
															? 'opacity-100'
															: 'opacity-35'}"
													></span>
													<span class="flex min-w-0 flex-1 items-center gap-2">
														<span
															class="max-w-[45%] shrink-0 truncate font-semibold text-on-surface"
														>
															{subcategory.title}
														</span>
														<span class="h-3 w-px shrink-0 bg-outline-variant/60"></span>
														<span class="min-w-0 truncate text-sm text-on-surface-variant">
															{subcategory.description || 'No notes yet.'}
														</span>
													</span>
												</span>
											</button>
										{/each}
									</div>
								{:else}
									<div
										class="rounded-lg border border-dashed border-outline-variant/45 bg-surface-0/35 px-4 py-5 text-sm text-on-surface-variant"
									>
										No subcategories yet.
									</div>
								{/if}
							</div>
						</section>
					{:else}
						<div class="px-4 py-12 text-center">
							<p class="text-sm font-semibold text-on-surface">No categories yet</p>
							<p class="mt-1 text-sm text-on-surface-variant">
								Add broad buckets like Personal, Work, or Condo.
							</p>
						</div>
					{/each}
				</div>
			</div>

			<aside
				class="sticky top-20 overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.2)]"
				data-testid="work-settings-drawer"
			>
				<div class="border-b border-outline-variant/35 px-4 py-4">
					<p class="flex items-center gap-2 text-xs font-semibold text-primary">
						{#if drawerIsCategory}
							<Folder class="h-4 w-4" />
						{:else}
							<ListTree class="h-4 w-4" />
						{/if}
						{drawerEyebrow}
					</p>
					<h3 class="mt-2 text-xl font-semibold text-on-surface">{drawerTitle}</h3>
					<div class="mt-3 rounded-lg bg-surface-1/65 px-3 py-2">
						<p class="text-xs text-on-surface-variant">
							{drawerMode === 'new_category'
								? 'Creating'
								: drawerMode === 'new_subcategory'
									? 'Parent category'
									: 'Selected'}
						</p>
						<p class="mt-0.5 truncate text-sm font-semibold text-on-surface">{selectedLabel()}</p>
					</div>
				</div>

				<form class="space-y-4 px-4 py-4" onsubmit={submitDrawer}>
					{#if !drawerIsCategory}
						<label class="grid gap-1.5 text-xs font-semibold text-on-surface-variant">
							Category
							<select
								bind:value={draft.parent_category_id}
								required
								class="falcon-focus min-h-11 rounded-md border border-outline-variant/55 bg-surface-1 px-3 text-sm text-on-surface"
							>
								{#each parentCategoryOptions as category (category.id)}
									<option value={category.id}>{category.title}</option>
								{/each}
							</select>
						</label>
					{/if}

					<label class="grid gap-1.5 text-xs font-semibold text-on-surface-variant">
						Name
						<input
							bind:value={draft.title}
							required
							class="falcon-focus min-h-11 rounded-md border border-outline-variant/55 bg-surface-1 px-3 text-sm text-on-surface placeholder:text-on-surface-variant/55"
							placeholder={drawerIsCategory ? 'Work' : 'Falcon Dash'}
						/>
					</label>

					<label class="grid gap-1.5 text-xs font-semibold text-on-surface-variant">
						Notes
						<textarea
							bind:value={draft.description}
							rows="4"
							class="falcon-focus min-h-28 resize-y rounded-md border border-outline-variant/55 bg-surface-1 px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/55"
							placeholder="What belongs here?"
						></textarea>
					</label>

					{#if drawerMode === 'edit_category'}
						<button
							type="button"
							onclick={() => openNewSubcategory(selectedCategoryId)}
							class="falcon-focus flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-outline-variant/60 bg-surface-1/55 px-4 text-sm font-semibold text-on-surface transition hover:bg-surface-1"
						>
							<Plus class="h-4 w-4" />
							Add subcategory to this category
						</button>
					{/if}

					<div class="grid gap-2 pt-1 sm:grid-cols-[1fr_auto]">
						<button
							type="submit"
							disabled={saving ||
								!draft.title.trim() ||
								(!drawerIsCategory && !draft.parent_category_id)}
							class="falcon-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
						>
							<Save class="h-4 w-4" />
							{drawerMode === 'new_category' || drawerMode === 'new_subcategory'
								? 'Create'
								: 'Save'}
						</button>
						{#if hasEditableSelection()}
							<button
								type="button"
								disabled={saving}
								onclick={deleteSelected}
								class="falcon-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-status-danger/45 px-4 text-sm font-semibold text-status-danger transition hover:bg-status-danger-bg disabled:opacity-60"
							>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						{/if}
					</div>
				</form>

				<div class="border-t border-outline-variant/35 px-4 py-4">
					{#if saveMessage}
						<p
							class="rounded-md border border-status-active/35 bg-status-active-bg px-3 py-2 text-sm text-status-active"
						>
							{saveMessage}
						</p>
					{/if}
					{#if error}
						<p
							class="rounded-md border border-status-danger/35 bg-status-danger-bg px-3 py-2 text-sm text-status-danger"
						>
							{error}
						</p>
					{/if}
					{#if !saveMessage && !error}
						<p class="text-sm text-on-surface-variant">
							Categories are broad life or work buckets. Subcategories are the smaller groups inside
							them.
						</p>
					{/if}
				</div>
			</aside>
		</div>
	{/if}
</section>
