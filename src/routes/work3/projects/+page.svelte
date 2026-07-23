<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '../Nav.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	function healthColor(health: unknown): string {
		if (health === 'on_track') return 'text-emerald-400';
		if (health === 'blocked') return 'text-red-400';
		if (health === 'at_risk') return 'text-amber-400';
		return 'text-status-muted';
	}
</script>

<svelte:head><title>Projects — Work v3</title></svelte:head>

<div class="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
	<h1 class="text-xl font-semibold text-white">Projects</h1>
	<Nav />

	<div class="rounded border border-surface-border bg-surface-1">
		{#if data.projects.length === 0}
			<p class="px-4 py-6 text-sm text-status-muted">No projects yet.</p>
		{:else}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="text-xs text-status-muted">
						<th class="px-4 py-2 font-medium">Project</th>
						<th class="px-4 py-2 font-medium">Status</th>
						<th class="px-4 py-2 font-medium">Health</th>
						<th class="px-4 py-2 font-medium">Progress</th>
						<th class="px-4 py-2 font-medium">Next</th>
					</tr>
				</thead>
				<tbody>
					{#each data.projects as project (project.id)}
						{@const progress = project.progress as Record<string, unknown>}
						<tr class="border-t border-surface-border/60 hover:bg-surface-2/40">
							<td class="px-4 py-2">
								<a
									class="text-blue-400 hover:underline"
									href={resolve('/work3/projects/[id]', { id: String(project.id) })}
								>
									{project.title}
								</a>
							</td>
							<td class="px-4 py-2 text-white/80">{project.status}</td>
							<td class="px-4 py-2 {healthColor(project.health)}">{project.health}</td>
							<td class="px-4 py-2 text-xs text-status-muted">
								criteria {progress.criteria} · milestones {progress.milestones} · open {progress.work_open}
							</td>
							<td class="px-4 py-2 font-mono text-xs text-status-muted"
								>{project.current_next_item_id ?? '—'}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
