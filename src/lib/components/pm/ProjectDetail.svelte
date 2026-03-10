<script lang="ts">
	import { getProject, updateProject, deleteProject, type Project } from '$lib/stores/pm-projects.js';
	import { listActivities, type Activity } from '$lib/stores/pm-operations.js';
	import {
		categories,
		subcategories,
		loadCategories,
		loadSubcategories,
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
	import { formatStatusLabel, formatRelativeTime, getStatusPill, getPlanStatusPill } from './pm-utils.js';
	import { SURFACE, TEXT, SPACE, STATUS_COLORS, type StatusKey } from '$lib/components/ui/design-tokens.js';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';

	interface Props {
		projectId: number;
		onClose?: () => void;
	}

	let { projectId, onClose }: Props = $props();

	let project = $state<Project | null>(null);
	let category = $state<Category | null>(null);
	let subcategory = $state<Subcategory | null>(null);
	let activities = $state<Activity[]>([]);
	let projectPlans = $state<Plan[]>([]);
	let activeTab = $state<'overview' | 'plans' | 'activity'>('overview');
	let loading = $state(false);

	// Body editing state
	let editingBody = $state(false);
	let bodyContent = $state('');

	// Plan modal state
	let showPlanModal = $state(false);
	let editingPlanId = $state<number | null>(null);
	let planTitle = $state('');
	let planStatus = $state('planning');
	let planDescription = $state('');
	let planResult = $state('');

	// Version modal state
	let showVersionModal = $state(false);
	let versionPlanId = $state<number | null>(null);
	let versions = $state<PlanVersion[]>([]);

	// Delete confirmation state
	let showDeleteConfirm = $state(false);
	let deleteType = $state<'project' | 'plan'>('project');
	let deleteTargetId = $state<number | null>(null);

	// Get data from stores
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
		if (!projectId) return;
		
		loading = true;
		try {
			await loadCategories();
			await loadSubcategories();

			const proj = await getProject(projectId);
			project = proj;
			bodyContent = proj.body || '';

			category = categoryList.find((c) => c.id === proj.category_id) || null;
			subcategory = proj.subcategory_id
				? subcategoryList.find((s) => s.id === proj.subcategory_id) || null
				: null;

			await loadPlans(projectId);
			activities = await listActivities(projectId);
		} catch (err) {
			console.error('[ProjectDetail] Failed to load project:', err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadData();
	});

	async function updateField(field: string, value: any) {
		if (!project) return;
		try {
			await updateProject(project.id, { [field]: value });
			// Reload to get updated data
			await loadData();
		} catch (err) {
			console.error(`Failed to update ${field}:`, err);
		}
	}

	function toggleBodyEdit() {
		if (editingBody) {
			// Save
			updateField('body', bodyContent);
		}
		editingBody = !editingBody;
	}

	function openPlanModal(planId?: number) {
		const plan = planId ? projectPlans.find((p) => p.id === planId) : null;
		editingPlanId = planId || null;
		planTitle = plan?.title || '';
		planStatus = plan?.status || 'planning';
		planDescription = plan?.description || '';
		planResult = plan?.result || '';
		showPlanModal = true;
	}

	function resetPlanModal() {
		showPlanModal = false;
		editingPlanId = null;
		planTitle = '';
		planStatus = 'planning';
		planDescription = '';
		planResult = '';
	}

	async function savePlan() {
		if (!planTitle.trim() || !project) return;

		try {
			if (editingPlanId) {
				await updatePlan(editingPlanId, {
					title: planTitle.trim(),
					status: planStatus,
					description: planDescription.trim() || undefined,
					result: planResult.trim() || undefined
				});
			} else {
				await createPlan({
					project_id: project.id,
					title: planTitle.trim(),
					status: planStatus,
					description: planDescription.trim() || undefined,
					result: planResult.trim() || undefined
				});
			}
			resetPlanModal();
		} catch (err) {
			console.error('Failed to save plan:', err);
		}
	}

	async function openVersionHistory(planId: number) {
		try {
			await loadPlanVersions(planId);
			versionPlanId = planId;
			showVersionModal = true;
		} catch (err) {
			console.error('Failed to load plan versions:', err);
		}
	}

	async function revertVersion(planId: number, version: number) {
		try {
			await revertPlanVersion(planId, version);
			showVersionModal = false;
		} catch (err) {
			console.error('Failed to revert plan version:', err);
		}
	}

	function confirmDelete(type: 'project' | 'plan', targetId?: number) {
		deleteType = type;
		deleteTargetId = targetId || null;
		showDeleteConfirm = true;
	}

	async function executeDelete() {
		try {
			if (deleteType === 'project' && project) {
				await deleteProject(project.id);
				onClose?.();
			} else if (deleteType === 'plan' && deleteTargetId) {
				await deletePlan(deleteTargetId);
			}
			showDeleteConfirm = false;
		} catch (err) {
			console.error('Failed to delete:', err);
		}
	}

	const statusOptions = [
		{ value: 'todo', label: 'Active' },
		{ value: 'in_progress', label: 'Active' },
		{ value: 'review', label: 'On Hold' },
		{ value: 'done', label: 'Done' },
		{ value: 'archived', label: 'Archived' }
	];

	const priorityOptions = [
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
		{ value: 'urgent', label: 'Urgent' }
	];

	const planStatusOptions = [
		{ value: 'planning', label: 'Planning' },
		{ value: 'assigned', label: 'Assigned' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'needs_review', label: 'Needs Review' },
		{ value: 'complete', label: 'Complete' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	function formatDateTime(unixSeconds: number): string {
		const date = new Date(unixSeconds * 1000);
		return date.toLocaleDateString('en-US', { 
			month: 'short', 
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if loading}
	<div class="flex h-full items-center justify-center {TEXT.body} text-status-muted">
		Loading...
	</div>
{:else if !project}
	<div class="flex h-full items-center justify-center {TEXT.body} text-status-muted">
		Project not found.
	</div>
{:else}
	<div class="h-full flex flex-col">
		<!-- Top bar -->
		<div class="flex-shrink-0 p-4 bg-surface-2 border-b {SURFACE.border}">
			<div class="flex items-center justify-between">
				<button
					onclick={onClose}
					class="flex items-center gap-2 text-status-muted hover:text-white transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
					</svg>
					Back to Projects
				</button>
				<button
					onclick={() => confirmDelete('project')}
					class="px-3 py-1.5 bg-status-danger/20 text-status-danger hover:bg-status-danger/30 rounded-lg {TEXT.badge} font-medium transition-colors"
				>
					Delete Project
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-auto custom-scrollbar p-6">
			<div class="max-w-4xl mx-auto space-y-6">
				<!-- Header card -->
				<div class="bg-surface-2 rounded-xl p-6">
					<div class="flex items-start gap-4">
						<div
							class="w-4 h-4 rounded-full mt-1 flex-shrink-0"
							style="background: {category?.color || '#6366f1'}"
						></div>
						<div class="flex-1">
							<input
								type="text"
								value={project.title}
								oninput={(e) => updateField('title', e.currentTarget.value)}
								class="{TEXT.pageTitle} font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-status-info rounded w-full"
							/>
							<div class="flex flex-wrap gap-2 mt-2 {TEXT.body} text-status-muted">
								<span>{category?.name || 'No category'}</span>
								{#if subcategory}
									<span>• {subcategory.name}</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Grid of dropdowns -->
					<div class="grid sm:grid-cols-4 gap-4 mt-6">
						<div>
							<label class="block {TEXT.label} text-status-muted mb-1">Status</label>
							<select
								value={project.status}
								onchange={(e) => updateField('status', e.currentTarget.value)}
								class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
							>
								{#each statusOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block {TEXT.label} text-status-muted mb-1">Priority</label>
							<select
								value={project.priority || 'medium'}
								onchange={(e) => updateField('priority', e.currentTarget.value)}
								class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
							>
								{#each priorityOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block {TEXT.label} text-status-muted mb-1">Due Date</label>
							<input
								type="date"
								value={project.due_date || ''}
								onchange={(e) => updateField('due_date', e.currentTarget.value || null)}
								class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
							/>
						</div>
						<div>
							<label class="block {TEXT.label} text-status-muted mb-1">Category</label>
							<select
								value={project.category_id}
								onchange={(e) => updateField('category_id', e.currentTarget.value)}
								class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
							>
								{#each categoryList as cat}
									<option value={cat.id}>{cat.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Description -->
					<div class="mt-4">
						<label class="block {TEXT.label} text-status-muted mb-1">Description</label>
						<textarea
							value={project.description || ''}
							oninput={(e) => updateField('description', e.currentTarget.value || null)}
							rows="2"
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info resize-none"
						></textarea>
					</div>
				</div>

				<!-- Tab bar -->
				<div class="flex gap-2 border-b {SURFACE.border}">
					<button
						onclick={() => (activeTab = 'overview')}
						class="detail-tab px-4 py-2 {TEXT.body} font-medium border-b-2 {activeTab === 'overview'
							? 'border-status-info text-white'
							: 'border-transparent text-status-muted hover:text-white'}"
					>
						Overview
					</button>
					<button
						onclick={() => (activeTab = 'plans')}
						class="detail-tab px-4 py-2 {TEXT.body} font-medium border-b-2 {activeTab === 'plans'
							? 'border-status-info text-white'
							: 'border-transparent text-status-muted hover:text-white'}"
					>
						Plans ({projectPlans.length})
					</button>
					<button
						onclick={() => (activeTab = 'activity')}
						class="detail-tab px-4 py-2 {TEXT.body} font-medium border-b-2 {activeTab === 'activity'
							? 'border-status-info text-white'
							: 'border-transparent text-status-muted hover:text-white'}"
					>
						Activity
					</button>
				</div>

				<!-- Tab content -->
				{#if activeTab === 'overview'}
					<div class="bg-surface-2 rounded-xl p-6">
						<div class="flex items-center justify-between mb-4">
							<h3 class="font-semibold">Body</h3>
							<button
								onclick={toggleBodyEdit}
								class="{TEXT.body} text-status-info hover:text-status-info/80"
							>
								{editingBody ? 'Save' : 'Edit'}
							</button>
						</div>
						{#if editingBody}
							<div>
								<textarea
									bind:value={bodyContent}
									rows="12"
									class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info resize-none font-mono"
								></textarea>
								<div class="flex justify-end gap-2 mt-3">
									<button
										onclick={() => {
											bodyContent = project?.body || '';
											editingBody = false;
										}}
										class="px-3 py-1.5 {TEXT.body} text-status-muted hover:text-white"
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<div class="prose prose-invert max-w-none">
								{#if project.body}
									<MarkdownRenderer content={project.body} />
								{:else}
									<p class="text-status-muted">No content yet. Click Edit to add some.</p>
								{/if}
							</div>
						{/if}
					</div>
				{:else if activeTab === 'plans'}
					<div class="space-y-4">
						<div class="flex justify-end">
							<button
								onclick={() => openPlanModal()}
								class="px-4 py-2 bg-status-info hover:bg-status-info/80 rounded-lg {TEXT.body} font-medium flex items-center gap-2"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
								</svg>
								New Plan
							</button>
						</div>
						{#if projectPlans.length === 0}
							<div class="bg-surface-2 rounded-xl p-6 text-center text-status-muted">
								No plans yet. Create your first plan to organize your work.
							</div>
						{:else}
							<div class="space-y-3">
								{#each projectPlans as plan, idx (plan.id)}
									{@const statusPill = getPlanStatusPill(plan.status)}
									{@const versionCount = versions.filter((v) => v.plan_id === plan.id).length}

									<div class="bg-surface-2 rounded-xl p-4">
										<div class="flex items-start justify-between gap-4">
											<div class="flex items-start gap-3 flex-1 min-w-0">
												<span class="text-status-muted font-mono {TEXT.body} mt-0.5">{idx + 1}.</span>
												<div class="flex-1 min-w-0">
													<h4 class="font-medium text-white">{plan.title}</h4>
													<div class="flex items-center gap-2 mt-1">
														<span class="px-2 py-0.5 rounded {TEXT.badge} font-medium {statusPill.classes}">
															{statusPill.label}
														</span>
														{#if versionCount > 0}
															<button
																onclick={() => openVersionHistory(plan.id)}
																class="{TEXT.badge} text-status-muted hover:text-status-info"
															>
																{versionCount} version{versionCount > 1 ? 's' : ''}
															</button>
														{/if}
													</div>
													{#if plan.description}
														<div class="mt-3 {TEXT.body} text-status-muted prose prose-invert prose-sm max-w-none">
															<MarkdownRenderer content={plan.description} />
														</div>
													{/if}
													{#if plan.result}
														<div class="mt-3 p-3 bg-surface-3 rounded-lg">
															<p class="{TEXT.label} text-status-muted mb-1">Result</p>
															<div class="{TEXT.body} text-status-muted prose prose-invert prose-sm max-w-none">
																<MarkdownRenderer content={plan.result} />
															</div>
														</div>
													{/if}
												</div>
											</div>
											<div class="flex items-center gap-1">
												<button
													onclick={() => openPlanModal(plan.id)}
													class="p-2 hover:bg-surface-3 rounded-lg transition-colors"
													title="Edit"
												>
													<svg class="w-4 h-4 text-status-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
													</svg>
												</button>
												<button
													onclick={() => confirmDelete('plan', plan.id)}
													class="p-2 hover:bg-surface-3 rounded-lg transition-colors"
													title="Delete"
												>
													<svg class="w-4 h-4 text-status-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
													</svg>
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if activeTab === 'activity'}
					{#if activities.length === 0}
						<div class="bg-surface-2 rounded-xl p-6 text-center text-status-muted">
							No activity recorded yet.
						</div>
					{:else}
						<div class="bg-surface-2 rounded-xl divide-y divide-surface-border">
							{#each activities as activity}
								<div class="p-4 flex items-start gap-3">
									<div class="w-2 h-2 rounded-full bg-status-info mt-2 flex-shrink-0"></div>
									<div class="flex-1 min-w-0">
										<p class="{TEXT.body} text-white">{activity.action}</p>
										{#if activity.details}
											<p class="{TEXT.label} text-status-muted mt-0.5">{activity.details}</p>
										{/if}
										<p class="{TEXT.label} text-status-muted mt-1">{formatDateTime(activity.created_at)}</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Plan Modal -->
{#if showPlanModal}
	<div class="fixed inset-0 bg-black/60 z-40"></div>
	<div class="fixed inset-0 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-2 rounded-xl w-full max-w-2xl max-h-[90%] overflow-auto">
			<div class="p-6">
				<h3 class="{TEXT.pageTitle} mb-6">{editingPlanId ? 'Edit Plan' : 'New Plan'}</h3>
				<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); savePlan(); }}>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Title *</label>
						<input
							type="text"
							bind:value={planTitle}
							required
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						/>
					</div>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Status</label>
						<select
							bind:value={planStatus}
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info"
						>
							{#each planStatusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Description (Markdown)</label>
						<textarea
							bind:value={planDescription}
							rows="4"
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info resize-none font-mono"
						></textarea>
					</div>
					<div>
						<label class="block {TEXT.label} font-medium text-status-muted mb-1">Result (Markdown)</label>
						<textarea
							bind:value={planResult}
							rows="4"
							class="w-full px-3 py-2 bg-surface-3 border {SURFACE.border} rounded-lg {TEXT.body} focus:outline-none focus:border-status-info resize-none font-mono"
						></textarea>
					</div>
					<div class="flex justify-end gap-3 pt-4">
						<button
							type="button"
							onclick={resetPlanModal}
							class="px-4 py-2 text-status-muted hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-4 py-2 bg-status-info hover:bg-status-info/80 rounded-lg font-medium transition-colors"
						>
							Save Plan
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Version History Modal -->
{#if showVersionModal}
	<div class="fixed inset-0 bg-black/60 z-40"></div>
	<div class="fixed inset-0 flex items-center justify-center z-50 p-4">
		<div class="bg-surface-2 rounded-xl w-full max-w-2xl max-h-[90%] overflow-auto">
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="{TEXT.pageTitle}">Version History</h3>
					<button
						onclick={() => (showVersionModal = false)}
						class="p-2 hover:bg-surface-3 rounded-lg transition-colors"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
				{#if versions.length === 0}
					<p class="text-status-muted">No previous versions.</p>
				{:else}
					<div class="space-y-3">
						{#each versions as version}
							{@const statusPill = getPlanStatusPill(version.status)}
							<div class="bg-surface-3 rounded-lg p-4">
								<div class="flex items-start justify-between mb-2">
									<div>
										<span class="font-medium">Version {version.version}</span>
										<span class="{TEXT.body} text-status-muted ml-2">{formatDateTime(version.created_at)}</span>
									</div>
									<button
										onclick={() => revertVersion(version.plan_id, version.version)}
										class="{TEXT.body} text-status-info hover:text-status-info/80"
									>
										Revert
									</button>
								</div>
								<p class="{TEXT.body} text-white">{version.description || 'No description'}</p>
								<span class="text-xs px-2 py-0.5 rounded {statusPill.classes}">{statusPill.label}</span>
							</div>
						{/each}
					</div>
				{/if}
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
					{#if deleteType === 'project'}
						Are you sure you want to delete this project? This will also delete all associated plans and activity logs.
					{:else}
						Are you sure you want to delete this plan?
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