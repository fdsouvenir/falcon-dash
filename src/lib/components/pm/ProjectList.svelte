<script lang="ts">
	import {
		loadProjects,
		projects,
		projectsLoading,
		type Project
	} from '$lib/stores/pm-projects.js';
	import { focuses, type Focus } from '$lib/stores/pm-domains.js';

	interface Props {
		onselect?: (projectId: number) => void;
	}

	let { onselect }: Props = $props();

	let projectList = $state<Project[]>([]);
	let focusList = $state<Focus[]>([]);
	let loading = $state(false);

	$effect(() => {
		const u1 = projects.subscribe((v) => {
			projectList = v;
		});
		const u2 = focuses.subscribe((v) => {
			focusList = v;
		});
		const u3 = projectsLoading.subscribe((v) => {
			loading = v;
		});
		return () => {
			u1();
			u2();
			u3();
		};
	});

	$effect(() => {
		loadProjects();
	});

	function getFocusName(focusId: string): string {
		return focusList.find((f) => f.id === focusId)?.name || focusId;
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			todo: 'bg-gray-600 text-gray-200',
			in_progress: 'bg-blue-600 text-blue-100',
			review: 'bg-yellow-600 text-yellow-100',
			done: 'bg-green-600 text-green-100',
			cancelled: 'bg-red-600 text-red-100'
		};
		return colors[status] || 'bg-gray-600 text-gray-200';
	}

	function getPriorityColor(priority: string | null): string {
		const colors: Record<string, string> = {
			low: 'bg-gray-600 text-gray-200',
			normal: 'bg-blue-600 text-blue-100',
			high: 'bg-orange-600 text-orange-100',
			urgent: 'bg-red-600 text-red-100'
		};
		return colors[priority || 'normal'] || 'bg-gray-600 text-gray-200';
	}

	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp * 1000;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}

	const sorted = $derived([...projectList].sort((a, b) => b.last_activity_at - a.last_activity_at));
</script>

<div class="flex h-full flex-col overflow-auto p-4">
	{#if loading}
		<div class="flex flex-1 items-center justify-center text-base text-gray-400">Loading...</div>
	{:else if sorted.length === 0}
		<div class="flex flex-1 items-center justify-center text-base text-gray-400">
			No projects found
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each sorted as project (project.id)}
				<button
					class="min-h-[44px] rounded-lg border border-gray-700 bg-gray-800 p-4 text-left transition-colors hover:border-gray-500 hover:bg-gray-750"
					onclick={() => onselect?.(project.id)}
				>
					<div class="mb-2 text-base font-medium text-white">{project.title}</div>
					<div class="flex flex-wrap items-center gap-2">
						<span class="inline-block rounded px-2 py-1 text-xs {getStatusColor(project.status)}">
							{project.status.replace('_', ' ')}
						</span>
						{#if project.priority}
							<span
								class="inline-block rounded px-2 py-1 text-xs {getPriorityColor(project.priority)}"
							>
								{project.priority}
							</span>
						{/if}
					</div>
					<div class="mt-2 flex items-center justify-between text-sm text-gray-400">
						<span>{getFocusName(project.focus_id)}</span>
						<span>{formatRelativeTime(project.last_activity_at)}</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
