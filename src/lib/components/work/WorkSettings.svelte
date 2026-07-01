<script lang="ts">
	import { RefreshCw, Save } from '@lucide/svelte';
	import type { WorkCategory } from '$lib/work/work-ui.js';

	type CategoryResponse = {
		categories: WorkCategory[];
		subcategories: WorkCategory[];
		all: WorkCategory[];
	};

	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let saveMessage = $state<string | null>(null);
	let categories = $state<WorkCategory[]>([]);
	let subcategories = $state<WorkCategory[]>([]);
	let categoryDraft = $state({ title: '', description: '' });
	let subcategoryDraft = $state({ title: '', description: '', parent_category_id: '' });

	const activeCategories = $derived(categories.filter((category) => category.status === 'active'));

	$effect(() => {
		if (!subcategoryDraft.parent_category_id && activeCategories[0]) {
			subcategoryDraft.parent_category_id = activeCategories[0].id;
		}
	});

	$effect(() => {
		void loadCategories();
	});

	async function loadCategories() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/work/categories');
			if (!response.ok) throw new Error(`Category request failed: ${response.status}`);
			const data = (await response.json()) as CategoryResponse;
			categories = data.categories ?? [];
			subcategories = data.subcategories ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load categories';
		} finally {
			loading = false;
		}
	}

	async function createCategory(event: SubmitEvent) {
		event.preventDefault();
		await saveCategory({
			kind: 'category',
			title: categoryDraft.title,
			description: categoryDraft.description
		});
		categoryDraft = { title: '', description: '' };
	}

	async function createSubcategory(event: SubmitEvent) {
		event.preventDefault();
		await saveCategory({
			kind: 'subcategory',
			title: subcategoryDraft.title,
			description: subcategoryDraft.description,
			parent_category_id: subcategoryDraft.parent_category_id
		});
		subcategoryDraft = {
			title: '',
			description: '',
			parent_category_id: subcategoryDraft.parent_category_id
		};
	}

	async function updateCategory(category: WorkCategory) {
		await saveCategory(category, category.id);
	}

	async function saveCategory(payload: Partial<WorkCategory>, id?: string) {
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
			saveMessage = 'Saved';
			await loadCategories();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to save category';
		} finally {
			saving = false;
		}
	}

	function childrenFor(category: WorkCategory): WorkCategory[] {
		return subcategories.filter((subcategory) => subcategory.parent_category_id === category.id);
	}
</script>

<section
	class="overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
	data-testid="work-settings"
>
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/55 bg-surface-2/35 px-4 py-4"
	>
		<div>
			<h2 class="text-2xl font-semibold text-on-surface">Work settings</h2>
			<p class="mt-1 text-sm text-on-surface-variant">Categories and subcategories</p>
		</div>
		<button
			type="button"
			onclick={loadCategories}
			class="falcon-focus inline-flex min-h-10 items-center gap-2 rounded-md border border-outline-variant/70 px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2"
		>
			<RefreshCw class="h-4 w-4" />
			Refresh
		</button>
	</div>

	{#if loading}
		<p class="p-4 text-sm text-on-surface-variant">Loading settings...</p>
	{:else}
		<div class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div class="overflow-hidden rounded-lg border border-outline-variant/45 bg-surface-0/25">
				<div class="border-b border-outline-variant/35 px-4 py-3">
					<h3 class="text-sm font-semibold text-on-surface">Categories</h3>
				</div>
				<div class="divide-y divide-outline-variant/30">
					{#each categories as category (category.id)}
						<div class="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_9rem]">
							<div class="min-w-0">
								<div class="grid gap-2 sm:grid-cols-2">
									<label class="grid gap-1 text-xs text-on-surface-variant">
										Name
										<input
											bind:value={category.title}
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
										/>
									</label>
									<label class="grid gap-1 text-xs text-on-surface-variant">
										State
										<select
											bind:value={category.status}
											class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
										>
											<option value="active">Active</option>
											<option value="paused">Paused</option>
											<option value="archived">Archived</option>
										</select>
									</label>
								</div>
								<label class="mt-2 grid gap-1 text-xs text-on-surface-variant">
									Notes
									<input
										bind:value={category.description}
										class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
									/>
								</label>
								<div class="mt-3 flex flex-wrap gap-2">
									{#each childrenFor(category) as subcategory (subcategory.id)}
										<span class="falcon-chip px-2 py-1 text-xs">{subcategory.title}</span>
									{:else}
										<span class="text-xs text-on-surface-variant">No subcategories</span>
									{/each}
								</div>
							</div>
							<button
								type="button"
								disabled={saving}
								onclick={() => updateCategory(category)}
								class="falcon-focus inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
							>
								<Save class="h-4 w-4" />
								Save
							</button>
						</div>
					{:else}
						<p class="p-4 text-sm text-on-surface-variant">No categories yet.</p>
					{/each}
				</div>
			</div>

			<div class="space-y-4">
				<form
					class="rounded-lg border border-outline-variant/45 bg-surface-0/25 p-4"
					onsubmit={createCategory}
				>
					<h3 class="text-sm font-semibold text-on-surface">New category</h3>
					<label class="mt-3 grid gap-1 text-xs text-on-surface-variant">
						Name
						<input
							bind:value={categoryDraft.title}
							required
							class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
						/>
					</label>
					<label class="mt-2 grid gap-1 text-xs text-on-surface-variant">
						Notes
						<input
							bind:value={categoryDraft.description}
							class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
						/>
					</label>
					<button
						type="submit"
						disabled={saving}
						class="falcon-focus mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
					>
						<Save class="h-4 w-4" />
						Create
					</button>
				</form>

				<form
					class="rounded-lg border border-outline-variant/45 bg-surface-0/25 p-4"
					onsubmit={createSubcategory}
				>
					<h3 class="text-sm font-semibold text-on-surface">New subcategory</h3>
					<label class="mt-3 grid gap-1 text-xs text-on-surface-variant">
						Category
						<select
							bind:value={subcategoryDraft.parent_category_id}
							required
							class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
						>
							{#each activeCategories as category (category.id)}
								<option value={category.id}>{category.title}</option>
							{/each}
						</select>
					</label>
					<label class="mt-2 grid gap-1 text-xs text-on-surface-variant">
						Name
						<input
							bind:value={subcategoryDraft.title}
							required
							class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
						/>
					</label>
					<label class="mt-2 grid gap-1 text-xs text-on-surface-variant">
						Notes
						<input
							bind:value={subcategoryDraft.description}
							class="falcon-focus min-h-10 rounded-md border border-outline-variant/70 bg-surface-1 px-3 text-sm text-on-surface"
						/>
					</label>
					<button
						type="submit"
						disabled={saving || activeCategories.length === 0}
						class="falcon-focus mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
					>
						<Save class="h-4 w-4" />
						Create
					</button>
				</form>

				{#if saveMessage}
					<p class="text-sm text-status-active">{saveMessage}</p>
				{/if}
				{#if error}
					<p class="text-sm text-status-danger">{error}</p>
				{/if}
			</div>
		</div>
	{/if}
</section>
