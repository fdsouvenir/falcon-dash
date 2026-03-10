<script lang="ts">
	import {
		loadCrossProjectPlans,
		updatePlan,
		type CrossProjectPlan,
		PLAN_STATUSES
	} from '$lib/stores/pm-plans.js';
	import { getPlanStatusPill, formatRelativeTime } from './pm-utils.js';
	import { TEXT, SURFACE } from '$lib/components/ui/design-tokens.js';

	interface Props {
		onNavigateToProject?: (projectId: number) => void;
	}

	let { onNavigateToProject }: Props = $props();

	// Inbox sections: statuses that need attention
	const INBOX_SECTIONS: Array<{ status: string; label: string }> = [
		{ status: 'planning', label: 'Awaiting Approval' },
		{ status: 'assigned', label: 'Assigned' },
		{ status: 'in_progress', label: 'In Progress' },
		{ status: 'needs_review', label: 'Needs Review' }
	];

	const planStatusOptions = [
		{ value: 'planning', label: 'Planning' },
		{ value: 'assigned', label: 'Assigned' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'needs_review', label: 'Needs Review' },
		{ value: 'complete', label: 'Complete' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	let allPlans = $state<CrossProjectPlan[]>([]);
	let loading = $state(false);
	let openStatusDropdownId = $state<number | null>(null);

	async function loadPlans() {
		loading = true;
		try {
			// Fetch all active plans cross-project; group client-side
			const results = await Promise.all(INBOX_SECTIONS.map((s) => loadCrossProjectPlans(s.status)));
			allPlans = results.flat();
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadPlans();
	});

	// SSE live refresh
	let sseSource: EventSource | null = null;

	$effect(() => {
		function connectSSE() {
			if (sseSource) sseSource.close();
			sseSource = new EventSource('/api/pm/events');
			sseSource.addEventListener('pm-event', (e: MessageEvent) => {
				try {
					const event = JSON.parse(e.data);
					if (event.entityType === 'plan' || event.entityType === 'project') {
						loadPlans();
					}
				} catch {
					// ignore
				}
			});
			sseSource.onerror = () => {
				sseSource?.close();
				sseSource = null;
				setTimeout(connectSSE, 5000);
			};
		}
		connectSSE();
		return () => {
			sseSource?.close();
			sseSource = null;
		};
	});

	function plansByStatus(status: string): CrossProjectPlan[] {
		return allPlans.filter((p) => p.status === status);
	}

	async function changePlanStatus(planId: number, newStatus: string) {
		try {
			await updatePlan(planId, { status: newStatus });
			await loadPlans();
		} catch (err) {
			console.error('Failed to update plan status:', err);
		} finally {
			openStatusDropdownId = null;
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Toolbar -->
	<div class="flex-shrink-0 p-4 border-b {SURFACE.border} bg-surface-2">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">Plans Inbox</h2>
			<button
				onclick={loadPlans}
				title="Refresh"
				class="p-1.5 text-status-muted hover:text-white transition-colors rounded-lg hover:bg-surface-3"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					></path>
				</svg>
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-auto custom-scrollbar p-4 space-y-6">
		{#if loading}
			<div class="flex items-center justify-center py-12 {TEXT.body} text-status-muted">
				Loading...
			</div>
		{:else}
			{#each INBOX_SECTIONS as section}
				{@const sectionPlans = plansByStatus(section.status)}
				{#if sectionPlans.length > 0}
					<div>
						<h3 class="font-semibold mb-2 {TEXT.body} text-status-muted uppercase tracking-wide">
							{section.label} ({sectionPlans.length})
						</h3>
						<div class="bg-surface-2 rounded-xl divide-y divide-surface-border">
							{#each sectionPlans as plan (plan.id)}
								{@const statusPill = getPlanStatusPill(plan.status)}
								{@const isBlocked = (plan.blocked_by?.length ?? 0) > 0}
								<div class="p-3 flex items-center gap-3 {isBlocked ? 'opacity-60' : ''}">
									<!-- Status pill (clickable) -->
									<div class="relative flex-shrink-0">
										<button
											onclick={() =>
												(openStatusDropdownId = openStatusDropdownId === plan.id ? null : plan.id)}
											class="px-2 py-0.5 rounded {TEXT.badge} font-medium {statusPill.classes} hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-1"
											title="Click to change status"
										>
											{statusPill.label}
											<svg
												class="w-3 h-3 opacity-60"
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
										{#if openStatusDropdownId === plan.id}
											<div
												class="fixed inset-0 z-10"
												onclick={() => (openStatusDropdownId = null)}
											></div>
											<div
												class="absolute top-full left-0 mt-1 z-20 bg-surface-3 border {SURFACE.border} rounded-lg shadow-lg overflow-hidden min-w-36"
											>
												{#each planStatusOptions as opt}
													{@const optPill = getPlanStatusPill(opt.value)}
													<button
														onclick={() => changePlanStatus(plan.id, opt.value)}
														class="w-full text-left px-3 py-1.5 {TEXT.body} hover:bg-surface-2 transition-colors flex items-center gap-2 {plan.status ===
														opt.value
															? 'bg-surface-2'
															: ''}"
													>
														<span
															class="px-1.5 py-0.5 rounded {TEXT.badge} font-medium {optPill.classes}"
															>{optPill.label}</span
														>
													</button>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Plan title + blockers -->
									<div class="flex-1 min-w-0">
										<span class="font-medium text-white truncate block">{plan.title}</span>
										{#if plan.blocked_by && plan.blocked_by.length > 0}
											<span class="{TEXT.badge} text-status-muted">
												🔒 Blocked by: {plan.blocked_by.map((b) => b.title).join(', ')}
											</span>
										{/if}
									</div>

									<!-- Project name (clickable) -->
									<button
										onclick={() => onNavigateToProject?.(plan.project_id)}
										class="{TEXT.badge} text-status-info hover:text-status-info/80 transition-colors flex-shrink-0 truncate max-w-32"
										title="Go to project: {plan.project_title}"
									>
										<span class="text-status-muted font-mono">P-{plan.project_id}:</span>
										{plan.project_title}
									</button>

									<!-- Updated time -->
									<span class="{TEXT.badge} text-status-muted flex-shrink-0">
										{formatRelativeTime(plan.updated_at)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}

			{#if allPlans.length === 0}
				<div class="text-center text-status-muted py-12">
					<p>No plans need attention right now.</p>
				</div>
			{/if}
		{/if}
	</div>
</div>

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
