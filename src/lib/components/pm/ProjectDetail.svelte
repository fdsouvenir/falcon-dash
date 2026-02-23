<script lang="ts">
	import { getProject, type Project } from '$lib/stores/pm-projects.js';
	import { listActivities, type Activity } from '$lib/stores/pm-operations.js';
	import { getDomain, getFocus, type Domain, type Focus } from '$lib/stores/pm-domains.js';
	import {
		STATUS_BADGE,
		formatStatusLabel,
		formatRelativeTime,
		getPriorityTag
	} from './pm-utils.js';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';

	interface Props {
		projectId: number;
		onClose?: () => void;
	}

	let { projectId, onClose }: Props = $props();

	let project = $state<Project | null>(null);
	let domain = $state<Domain | null>(null);
	let focus = $state<Focus | null>(null);
	let activities = $state<Activity[]>([]);
	let activeTab = $state<'status' | 'activity'>('status');
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function loadData() {
		loading = true;
		error = null;
		try {
			project = await getProject(projectId);
			if (project) {
				if (project.focus_id) {
					try {
						focus = await getFocus(project.focus_id);
						if (focus?.domain_id) {
							domain = await getDomain(focus.domain_id);
						}
					} catch {
						// domain/focus lookup is non-critical
					}
				}
				activities = await listActivities(projectId, 20);
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

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose?.();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
	onkeydown={handleBackdropKeydown}
>
	<div
		class="flex h-full w-full flex-col overflow-hidden bg-gray-900 shadow-xl md:h-auto md:max-h-[90vh] md:w-auto md:max-w-4xl md:rounded-lg"
	>
		{#if loading}
			<div class="p-8 text-center text-base text-gray-400">Loading...</div>
		{:else if error}
			<div class="p-8">
				<div class="mb-4 text-base text-red-500">Error: {error}</div>
				<button
					onclick={onClose}
					class="min-h-[44px] rounded bg-gray-700 px-4 py-3 text-base text-white hover:bg-gray-600"
				>
					Close
				</button>
			</div>
		{:else if project}
			<!-- Header -->
			<div class="border-b border-gray-700 bg-gray-800 px-3 py-2">
				<!-- Row 1: breadcrumb bar -->
				<div class="flex min-h-[36px] items-center gap-2">
					<button
						onclick={onClose}
						class="min-h-[36px] min-w-[36px] shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white"
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

					{#if domain && focus}
						<span class="shrink-0 text-xs text-gray-500">
							{domain.name} / {focus.name}
						</span>
					{/if}

					<span class="flex-1"></span>

					<span
						class="shrink-0 rounded px-1.5 py-0.5 text-xs {STATUS_BADGE[project.status] ||
							'bg-gray-600 text-gray-200'}"
					>
						{formatStatusLabel(project.status)}
					</span>

					{#if getPriorityTag(project.priority)}
						{@const pt = getPriorityTag(project.priority)!}
						<span class="shrink-0 rounded px-1.5 py-0.5 text-xs {pt.classes}">
							{pt.label}
						</span>
					{/if}

					{#if project.due_date}
						<span class="shrink-0 text-xs text-gray-400">{project.due_date}</span>
					{/if}
				</div>

				<!-- Row 2: title -->
				<h1 class="px-1 pt-1 pb-0.5 text-base font-semibold text-white">
					{project.title}
				</h1>

				<!-- Row 3: description subtitle -->
				{#if project.description}
					<p class="line-clamp-1 px-1 pb-1 text-xs text-gray-400">
						{project.description}
					</p>
				{/if}
			</div>

			<!-- Tabs -->
			<div class="border-b border-gray-700 bg-gray-800">
				<div class="flex gap-1 px-4">
					<button
						onclick={() => {
							activeTab = 'status';
						}}
						class="min-h-[40px] px-3 py-2 text-xs font-medium {activeTab === 'status'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Status
					</button>
					<button
						onclick={() => {
							activeTab = 'activity';
						}}
						class="min-h-[40px] px-3 py-2 text-xs font-medium {activeTab === 'activity'
							? 'border-b-2 border-blue-500 text-white'
							: 'text-gray-400 hover:text-white'}"
					>
						Activity
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="flex-1 overflow-y-auto">
				{#if activeTab === 'status'}
					<div class="p-4">
						{#if project.body}
							<MarkdownRenderer content={project.body} />
						{:else}
							<p class="text-sm text-gray-500">No status content yet.</p>
						{/if}
					</div>
				{:else if activeTab === 'activity'}
					<div class="divide-y divide-gray-800">
						{#each activities as activity (activity.id)}
							<div class="px-4 py-2.5">
								<div class="text-xs">
									<span class="font-medium text-white">{activity.actor}</span>
									<span class="text-gray-400">
										{activity.action}
									</span>
									<span class="text-white">
										{activity.target_title || ''}
									</span>
								</div>
								{#if activity.details}
									<div class="mt-0.5 text-xs text-gray-500">
										{activity.details}
									</div>
								{/if}
								<div class="mt-0.5 text-xs text-gray-600">
									{formatRelativeTime(activity.created_at)}
								</div>
							</div>
						{/each}
						{#if activities.length === 0}
							<p class="p-4 text-sm text-gray-500">No recent activity</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
