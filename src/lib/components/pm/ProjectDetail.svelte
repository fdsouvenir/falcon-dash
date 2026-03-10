<script lang="ts">
	import { fly } from 'svelte/transition';
	import { getProject, updateProject, deleteProject, type Project } from '$lib/stores/pm-projects.js';
	import { listActivities, type Activity } from '$lib/stores/pm-operations.js';
	import {
		categories,
		subcategories,
		loadCategories,
		loadSubcategories,
		getSubcategoriesByCategory,
		type Category,
		type Subcategory
	} from '$lib/stores/pm-categories.js';
	import {
		plans,
		loadPlans,
		createPlan,
		updatePlan,
		deletePlan,
		loadPlanVersions,
		planVersions,
		revertPlanVersion,
		type Plan,
		type PlanVersion,
		PLAN_STATUSES
	} from '$lib/stores/pm-plans.js';
	import { formatStatusLabel, formatRelativeTime } from './pm-utils.js';
	import { getStatusColor, BADGE, getPriority } from '$lib/components/ui/design-tokens.js';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';

	interface Props {
		projectId: number;
		onClose?: () => void;
		onDeleted?: () => void;
	}

	let { projectId, onClose, onDeleted }: Props = $props();

	let project = $state<Project | null>(null);
	let category = $state<Category | null>(null);
	let subcategory = $state<Subcategory | null>(null);
	let activities = $state<Activity[]>([]);
	let activeTab = $state<'status' | 'activity' | 'plans'>('status');
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Editing state
	let editingTitle = $state(false);
	let editTitle = $state('');
	let editStatus = $state('');
	let editPriority = $state('');
	let editCategoryId = $state('');
	let editSubcategoryId = $state('');
	let editDueDate = $state('');

	// Plans state
	let projectPlans = $state<Plan[]>([]);
	let showNewPlan = $state(false);
	let newPlanTitle = $state('');
	let newPlanDescription = $state('');
	let expandedPlans = $state(new Set<number>());
	let editingPlan = $state<number | null>(null);
	let editPlanData = $state<Partial<Plan>>({});
	let showVersions = $state<number | null>(null);
	let versions = $state<PlanVersion[]>([]);

	// Confirmation state
	let showDeleteConfirm = $state(false);

	// Get categories and subcategories from stores
	let categoryList = $state<Category[]>([]);
	let subcategoryList = $state<Subcategory[]>([]);

	$effect(() => {
		const u1 = categories.subscribe((v) => {
			categoryList = v;
		});
		const u2 = subcategories.subscribe((v) => {
			subcategoryList = v;
		});
		const u3 = plans.subscribe((v) => {
			projectPlans = v;
		});
		const u4 = planVersions.subscribe((v) => {
			versions = v;
		});
		return () => {
			u1();
			u2();
			u3();
			u4();
		};
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadCategories();
			await loadSubcategories();
			
			project = await getProject(projectId);
			if (project) {
				// Load category and subcategory info
				category = categoryList.find((c) => c.id === project!.category_id) ?? null;
				if (project.subcategory_id) {
					subcategory = subcategoryList.find((s) => s.id === project.subcategory_id) ?? null;
				}
				
				// Initialize edit values
				editTitle = project.title;
				editStatus = project.status;
				editPriority = project.priority || '';
				editCategoryId = project.category_id;
				editSubcategoryId = project.subcategory_id || '';
				editDueDate = project.due_date || '';

				// Load related data
				activities = await listActivities(projectId, 20);
				await loadPlans(projectId);
			}
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadData();
	});

	// Update subcategory when category changes
	$effect(() => {
		if (editCategoryId && editSubcategoryId) {
			const availableSubs = getSubcategoriesByCategory(editCategoryId);
			const isValid = availableSubs.some((s) => s.id === editSubcategoryId);
			if (!isValid) {
				editSubcategoryId = '';
			}
		}
	});

	const availableSubcategories = $derived.by(() => {
		if (!editCategoryId) return [];
		return getSubcategoriesByCategory(editCategoryId);
	});

	async function handleTitleSave() {
		if (!project || !editTitle.trim()) return;
		try {
			await updateProject(project.id, { title: editTitle.trim() });
			editingTitle = false;
			project.title = editTitle.trim();
		} catch (err) {
			console.error('Failed to update title:', err);
		}
	}

	async function handleFieldUpdate(field: keyof Project, value: string) {
		if (!project) return;
		try {
			const update: any = {};
			if (field === 'category_id') update.category_id = value;
			else if (field === 'subcategory_id') update.subcategory_id = value || undefined;
			else if (field === 'status') update.status = value;
			else if (field === 'priority') update.priority = value || undefined;
			else if (field === 'due_date') update.due_date = value || undefined;

			await updateProject(project.id, update);
			(project as any)[field] = field === 'subcategory_id' || field === 'priority' || field === 'due_date' 
				? (value || null) 
				: value;

			// Update category/subcategory references
			if (field === 'category_id') {
				category = categoryList.find((c) => c.id === value) ?? null;
				subcategory = null;
			} else if (field === 'subcategory_id') {
				subcategory = value ? subcategoryList.find((s) => s.id === value) ?? null : null;
			}
		} catch (err) {
			console.error('Failed to update field:', err);
		}
	}

	async function handleDeleteProject() {
		if (!project) return;
		try {
			await deleteProject(project.id);
			showDeleteConfirm = false;
			onDeleted?.();
		} catch (err) {
			console.error('Failed to delete project:', err);
		}
	}

	// Plan functions
	function togglePlanExpanded(planId: number) {
		if (expandedPlans.has(planId)) {
			expandedPlans.delete(planId);
		} else {
			expandedPlans.add(planId);
		}
		expandedPlans = new Set(expandedPlans);
	}

	async function handleCreatePlan() {
		if (!project || !newPlanTitle.trim()) return;
		try {
			await createPlan({
				project_id: project.id,
				title: newPlanTitle.trim(),
				description: newPlanDescription.trim() || undefined
			});
			newPlanTitle = '';
			newPlanDescription = '';
			showNewPlan = false;
		} catch (err) {
			console.error('Failed to create plan:', err);
		}
	}

	async function startEditPlan(plan: Plan) {
		editingPlan = plan.id;
		editPlanData = {
			title: plan.title,
			description: plan.description || '',
			result: plan.result || '',
			status: plan.status
		};
	}

	async function handleUpdatePlan() {
		if (editingPlan === null || !editPlanData.title?.trim()) return;
		try {
			await updatePlan(editingPlan, {
				title: editPlanData.title.trim(),
				description: editPlanData.description?.trim() || undefined,
				result: editPlanData.result?.trim() || undefined,
				status: editPlanData.status
			});
			editingPlan = null;
			editPlanData = {};
		} catch (err) {
			console.error('Failed to update plan:', err);
		}
	}

	async function handleDeletePlan(planId: number) {
		if (!confirm('Delete this plan?')) return;
		try {
			await deletePlan(planId);
		} catch (err) {
			console.error('Failed to delete plan:', err);
		}
	}

	async function handleShowVersions(planId: number) {
		try {
			await loadPlanVersions(planId);
			showVersions = planId;
		} catch (err) {
			console.error('Failed to load versions:', err);
		}
	}

	async function handleRevertVersion(planId: number, version: number) {
		if (!confirm(`Revert to version ${version}?`)) return;
		try {
			await revertPlanVersion(planId, version);
			showVersions = null;
		} catch (err) {
			console.error('Failed to revert version:', err);
		}
	}

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

	const planStatusOptions = PLAN_STATUSES.map((status) => ({
		value: status,
		label: formatStatusLabel(status)
	}));
</script>

<!-- Inline side panel — slides in from the right -->
<div
	class="flex h-full min-w-[320px] flex-[2] flex-col overflow-hidden border-l border-surface-border bg-surface-1"
	transition:fly={{ x: 420, duration: 200 }}
>
	{#if loading}
		<div class="p-8 text-center text-[length:var(--text-body)] text-status-muted">Loading...</div>
	{:else if error}
		<div class="p-8">
			<div class="mb-4 text-[length:var(--text-body)] text-status-danger">Error: {error}</div>
			<button
				onclick={onClose}
				class="min-h-[44px] rounded-lg border border-surface-border bg-surface-2 px-4 py-3 text-[length:var(--text-body)] text-white hover:bg-surface-3"
			>
				Close
			</button>
		</div>
	{:else if project}
		<!-- Header -->
		<div class="border-b border-surface-border bg-surface-1 px-3 py-2">
			<!-- Row 1: breadcrumb bar -->
			<div class="flex min-h-[36px] items-center gap-2">
				<button
					onclick={onClose}
					class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-status-muted hover:bg-surface-3 hover:text-white"
					title="Back"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						></path>
					</svg>
				</button>

				{#if category}
					<span class="shrink-0 text-[length:var(--text-label)] text-status-muted">
						{category.name}
						{#if subcategory}
							<span class="text-status-muted/60"> / {subcategory.name}</span>
						{/if}
					</span>
				{/if}

				<span class="flex-1"></span>

				<span class="shrink-0 {BADGE.status(getStatusColor(project.status))}">
					{formatStatusLabel(project.status)}
				</span>

				{#if project.priority === 'urgent' || project.priority === 'high'}
					{@const pt = getPriority(project.priority)!}
					<span class="shrink-0 {BADGE.status(pt.color)}">
						{pt.label}
					</span>
				{/if}

				{#if project.due_date}
					<span class="shrink-0 text-[length:var(--text-label)] text-status-muted"
						>{project.due_date}</span
					>
				{/if}
			</div>

			<!-- Row 2: title (click to edit) -->
			<div class="px-1 pt-1 pb-0.5">
				{#if editingTitle}
					<div class="flex items-center gap-2">
						<input
							type="text"
							bind:value={editTitle}
							class="flex-1 rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-card-title)] font-semibold text-white focus:border-status-info focus:outline-none"
							onkeydown={(e) => {
								if (e.key === 'Enter') handleTitleSave();
								if (e.key === 'Escape') {
									editingTitle = false;
									editTitle = project!.title;
								}
							}}
						/>
						<button
							onclick={handleTitleSave}
							class="rounded bg-status-active px-2 py-1 text-[length:var(--text-badge)] text-white hover:bg-status-active/80"
						>
							Save
						</button>
					</div>
				{:else}
					<button
						onclick={() => {
							editingTitle = true;
							editTitle = project!.title;
						}}
						class="group w-full text-left"
					>
						<h1
							class="text-[length:var(--text-card-title)] font-semibold text-white group-hover:text-status-info"
						>
							{project.title}
						</h1>
					</button>
				{/if}
			</div>

			<!-- Row 3: description subtitle -->
			{#if project.description}
				<p class="line-clamp-1 px-1 pb-1 text-[length:var(--text-label)] text-status-muted">
					{project.description}
				</p>
			{/if}

			<!-- Row 4: editable fields -->
			<div class="grid grid-cols-2 gap-2 px-1 py-2">
				<!-- Status dropdown -->
				<div>
					<label class="block text-[length:var(--text-badge)] font-medium text-status-muted">
						Status
					</label>
					<select
						bind:value={editStatus}
						onchange={() => handleFieldUpdate('status', editStatus)}
						class="mt-1 w-full rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-badge)] text-white focus:border-status-info focus:outline-none"
					>
						{#each statusOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Priority dropdown -->
				<div>
					<label class="block text-[length:var(--text-badge)] font-medium text-status-muted">
						Priority
					</label>
					<select
						bind:value={editPriority}
						onchange={() => handleFieldUpdate('priority', editPriority)}
						class="mt-1 w-full rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-badge)] text-white focus:border-status-info focus:outline-none"
					>
						{#each priorityOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Category dropdown -->
				<div>
					<label class="block text-[length:var(--text-badge)] font-medium text-status-muted">
						Category
					</label>
					<select
						bind:value={editCategoryId}
						onchange={() => handleFieldUpdate('category_id', editCategoryId)}
						class="mt-1 w-full rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-badge)] text-white focus:border-status-info focus:outline-none"
					>
						{#each categoryList as cat (cat.id)}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
				</div>

				<!-- Subcategory dropdown -->
				<div>
					<label class="block text-[length:var(--text-badge)] font-medium text-status-muted">
						Subcategory
					</label>
					<select
						bind:value={editSubcategoryId}
						onchange={() => handleFieldUpdate('subcategory_id', editSubcategoryId)}
						disabled={!editCategoryId}
						class="mt-1 w-full rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-badge)] text-white focus:border-status-info focus:outline-none disabled:opacity-50"
					>
						<option value="">None</option>
						{#each availableSubcategories as sub (sub.id)}
							<option value={sub.id}>{sub.name}</option>
						{/each}
					</select>
				</div>

				<!-- Due date -->
				<div class="col-span-2">
					<label class="block text-[length:var(--text-badge)] font-medium text-status-muted">
						Due Date
					</label>
					<input
						type="date"
						bind:value={editDueDate}
						onchange={() => handleFieldUpdate('due_date', editDueDate)}
						class="mt-1 w-full rounded border border-surface-border bg-surface-2 px-2 py-1 text-[length:var(--text-badge)] text-white focus:border-status-info focus:outline-none"
					/>
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="border-b border-surface-border bg-surface-1">
			<div class="flex gap-1 px-4">
				<button
					onclick={() => {
						activeTab = 'status';
					}}
					class="min-h-[40px] px-3 py-2 text-[length:var(--text-badge)] font-medium {activeTab ===
					'status'
						? 'border-b-2 border-status-info text-white'
						: 'text-status-muted hover:text-white'}"
				>
					Status
				</button>
				<button
					onclick={() => {
						activeTab = 'plans';
					}}
					class="min-h-[40px] px-3 py-2 text-[length:var(--text-badge)] font-medium {activeTab ===
					'plans'
						? 'border-b-2 border-status-info text-white'
						: 'text-status-muted hover:text-white'}"
				>
					Plans ({projectPlans.length})
				</button>
				<button
					onclick={() => {
						activeTab = 'activity';
					}}
					class="min-h-[40px] px-3 py-2 text-[length:var(--text-badge)] font-medium {activeTab ===
					'activity'
						? 'border-b-2 border-status-info text-white'
						: 'text-status-muted hover:text-white'}"
				>
					Activity
				</button>

				<div class="flex-1"></div>

				<!-- Delete button -->
				<button
					onclick={() => (showDeleteConfirm = true)}
					class="min-h-[40px] px-3 py-2 text-[length:var(--text-badge)] font-medium text-status-danger hover:bg-status-danger-bg"
					title="Delete project"
				>
					Delete
				</button>
			</div>
		</div>

		<!-- Tab content -->
		<div class="flex-1 overflow-y-auto">
			{#if activeTab === 'status'}
				<div class="p-[var(--space-card-padding)]">
					{#if project.body}
						<MarkdownRenderer content={project.body} />
					{:else}
						<p class="text-[length:var(--text-body)] text-status-muted">No status content yet.</p>
					{/if}
				</div>

			{:else if activeTab === 'plans'}
				<div class="p-4">
					<!-- Create new plan -->
					<div class="mb-4">
						{#if showNewPlan}
							<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
								<h3 class="mb-3 text-[length:var(--text-card-title)] font-medium text-white">
									New Plan
								</h3>
								<div class="space-y-3">
									<input
										type="text"
										bind:value={newPlanTitle}
										placeholder="Plan title"
										class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none"
									/>
									<textarea
										bind:value={newPlanDescription}
										placeholder="Plan description"
										rows="3"
										class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none resize-none"
									></textarea>
									<div class="flex gap-2">
										<button
											onclick={handleCreatePlan}
											disabled={!newPlanTitle.trim()}
											class="rounded bg-status-active px-3 py-2 text-[length:var(--text-badge)] text-white hover:bg-status-active/80 disabled:opacity-50"
										>
											Create Plan
										</button>
										<button
											onclick={() => {
												showNewPlan = false;
												newPlanTitle = '';
												newPlanDescription = '';
											}}
											class="rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-badge)] text-white hover:bg-surface-3"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						{:else}
							<button
								onclick={() => (showNewPlan = true)}
								class="w-full rounded-lg border-2 border-dashed border-surface-border bg-surface-2 py-8 text-[length:var(--text-body)] text-status-muted hover:border-status-info hover:text-white"
							>
								+ Add new plan
							</button>
						{/if}
					</div>

					<!-- Plans list -->
					<div class="space-y-4">
						{#each projectPlans as plan (plan.id)}
							<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
								{#if editingPlan === plan.id}
									<!-- Edit mode -->
									<div class="space-y-3">
										<input
											type="text"
											bind:value={editPlanData.title}
											class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] font-medium text-white focus:border-status-info focus:outline-none"
										/>
										<div class="grid grid-cols-2 gap-3">
											<select
												bind:value={editPlanData.status}
												class="rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-badge)] text-white focus:border-status-info focus:outline-none"
											>
												{#each planStatusOptions as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
											<span class="text-[length:var(--text-label)] text-status-muted">
												v{plan.version || 1}
											</span>
										</div>
										<textarea
											bind:value={editPlanData.description}
											placeholder="Description"
											rows="3"
											class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none resize-none"
										></textarea>
										<textarea
											bind:value={editPlanData.result}
											placeholder="Result/outcome"
											rows="3"
											class="w-full rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-body)] text-white placeholder-status-muted focus:border-status-info focus:outline-none resize-none"
										></textarea>
										<div class="flex gap-2">
											<button
												onclick={handleUpdatePlan}
												class="rounded bg-status-active px-3 py-2 text-[length:var(--text-badge)] text-white hover:bg-status-active/80"
											>
												Save
											</button>
											<button
												onclick={() => {
													editingPlan = null;
													editPlanData = {};
												}}
												class="rounded border border-surface-border bg-surface-1 px-3 py-2 text-[length:var(--text-badge)] text-white hover:bg-surface-3"
											>
												Cancel
											</button>
										</div>
									</div>
								{:else}
									<!-- View mode -->
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<button
												onclick={() => togglePlanExpanded(plan.id)}
												class="w-full text-left"
											>
												<div class="flex items-center gap-2">
													<h4
														class="text-[length:var(--text-card-title)] font-medium text-white hover:text-status-info"
													>
														{plan.title}
													</h4>
													<span class="shrink-0 {BADGE.status(getStatusColor(plan.status))}">
														{formatStatusLabel(plan.status)}
													</span>
												</div>
												{#if plan.description}
													<p
														class="mt-1 text-[length:var(--text-body)] text-status-muted line-clamp-2"
													>
														{plan.description}
													</p>
												{/if}
											</button>

											<!-- Expanded content -->
											{#if expandedPlans.has(plan.id)}
												<div class="mt-4 space-y-3">
													{#if plan.description}
														<div>
															<h5
																class="text-[length:var(--text-label)] font-medium uppercase tracking-wider text-status-muted"
															>
																Description
															</h5>
															<div class="mt-1">
																<MarkdownRenderer content={plan.description} />
															</div>
														</div>
													{/if}
													{#if plan.result}
														<div>
															<h5
																class="text-[length:var(--text-label)] font-medium uppercase tracking-wider text-status-muted"
															>
																Result
															</h5>
															<div class="mt-1">
																<MarkdownRenderer content={plan.result} />
															</div>
														</div>
													{/if}
												</div>
											{/if}
										</div>

										<!-- Actions -->
										<div class="flex shrink-0 gap-1 ml-3">
											<button
												onclick={() => startEditPlan(plan)}
												class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white"
												title="Edit plan"
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
											<button
												onclick={() => handleShowVersions(plan.id)}
												class="rounded p-1 text-status-muted hover:bg-surface-3 hover:text-white"
												title="Version history"
											>
												<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
													></path>
												</svg>
											</button>
											<button
												onclick={() => handleDeletePlan(plan.id)}
												class="rounded p-1 text-status-danger hover:bg-status-danger-bg"
												title="Delete plan"
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
									</div>
								{/if}
							</div>
						{/each}

						{#if projectPlans.length === 0}
							<p class="text-center text-[length:var(--text-body)] text-status-muted py-8">
								No plans yet. Create one to get started.
							</p>
						{/if}
					</div>

					<!-- Version history modal -->
					{#if showVersions !== null}
						<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
							<div class="max-h-[80vh] w-[600px] overflow-auto rounded-lg bg-surface-1 border border-surface-border">
								<div class="border-b border-surface-border px-4 py-3">
									<h3 class="text-[length:var(--text-card-title)] font-medium text-white">
										Plan Version History
									</h3>
								</div>
								<div class="p-4 space-y-3">
									{#each versions as version (version.id)}
										<div class="flex items-center justify-between rounded border border-surface-border bg-surface-2 p-3">
											<div class="flex-1">
												<div class="text-[length:var(--text-body)] font-medium text-white">
													Version {version.version}
												</div>
												<div class="text-[length:var(--text-label)] text-status-muted">
													{formatRelativeTime(version.created_at)} by {version.created_by}
												</div>
											</div>
											<button
												onclick={() => handleRevertVersion(showVersions!, version.version)}
												class="rounded bg-status-warning px-3 py-1 text-[length:var(--text-badge)] text-white hover:bg-status-warning/80"
											>
												Revert
											</button>
										</div>
									{/each}
								</div>
								<div class="border-t border-surface-border px-4 py-3">
									<button
										onclick={() => (showVersions = null)}
										class="rounded bg-surface-2 border border-surface-border px-4 py-2 text-[length:var(--text-body)] text-white hover:bg-surface-3"
									>
										Close
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'activity'}
				<div class="divide-y divide-surface-border">
					{#each activities as activity (activity.id)}
						<div class="px-[var(--space-row-x)] py-[var(--space-row-y)]">
							<div class="text-[length:var(--text-body)]">
								<span class="font-medium text-white">{activity.actor}</span>
								<span class="text-status-muted">
									{activity.action}
								</span>
								<span class="text-white">
									{activity.target_title || ''}
								</span>
							</div>
							{#if activity.details}
								<div class="mt-0.5 text-[length:var(--text-label)] text-status-muted">
									{activity.details}
								</div>
							{/if}
							<div class="mt-0.5 text-[length:var(--text-label)] text-status-muted/60">
								{formatRelativeTime(activity.created_at)}
							</div>
						</div>
					{/each}
					{#if activities.length === 0}
						<p
							class="p-[var(--space-card-padding)] text-[length:var(--text-body)] text-status-muted"
						>
							No recent activity
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Delete confirmation modal -->
		{#if showDeleteConfirm}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div class="w-[400px] rounded-lg bg-surface-1 border border-surface-border">
					<div class="border-b border-surface-border px-4 py-3">
						<h3 class="text-[length:var(--text-card-title)] font-medium text-white">
							Delete Project
						</h3>
					</div>
					<div class="p-4">
						<p class="text-[length:var(--text-body)] text-status-muted">
							Are you sure you want to delete "{project.title}"? This action cannot be undone.
						</p>
					</div>
					<div class="border-t border-surface-border flex gap-2 px-4 py-3">
						<button
							onclick={handleDeleteProject}
							class="rounded bg-status-danger px-4 py-2 text-[length:var(--text-body)] font-medium text-white hover:bg-status-danger/80"
						>
							Delete
						</button>
						<button
							onclick={() => (showDeleteConfirm = false)}
							class="rounded border border-surface-border bg-surface-2 px-4 py-2 text-[length:var(--text-body)] text-white hover:bg-surface-3"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>