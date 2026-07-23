<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	function healthColor(health: unknown): string {
		if (health === 'ok') return 'text-emerald-400';
		if (health === 'failing' || health === 'unreachable') return 'text-red-400';
		if (health === 'paused') return 'text-amber-400';
		return 'text-status-muted';
	}
</script>

<svelte:head><title>Automata — Work v3</title></svelte:head>

<div class="mx-auto max-w-4xl space-y-5 p-6">
	<div class="flex items-baseline justify-between">
		<h1 class="text-xl font-semibold text-white">Automata</h1>
		<a href={resolve('/work')} class="text-xs text-blue-400 hover:underline">Work v3</a>
	</div>

	{#if data.runtimeError}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			OpenClaw runtime unreachable: {data.runtimeError}
		</div>
	{/if}

	<div class="rounded border border-surface-border bg-surface-1">
		{#if data.automata.length === 0 && !data.runtimeError}
			<p class="px-4 py-6 text-sm text-status-muted">No Automata exist yet.</p>
		{:else}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="text-xs text-status-muted">
						<th class="px-4 py-2 font-medium">Name</th>
						<th class="px-4 py-2 font-medium">Lifecycle</th>
						<th class="px-4 py-2 font-medium">Health</th>
						<th class="px-4 py-2 font-medium">Next run</th>
						<th class="px-4 py-2 font-medium">Last run</th>
					</tr>
				</thead>
				<tbody>
					{#each data.automata as automaton (automaton.id)}
						<tr class="border-t border-surface-border/60 hover:bg-surface-2/40">
							<td class="px-4 py-2">
								<a
									class="text-blue-400 hover:underline"
									href={resolve('/work/automata/[id]', { id: String(automaton.id) })}
									>{automaton.name}</a
								>
							</td>
							<td class="px-4 py-2 text-white/80">{automaton.lifecycle}</td>
							<td class="px-4 py-2 {healthColor(automaton.health)}">{automaton.health}</td>
							<td class="px-4 py-2 text-status-muted">
								{automaton.next_run_at_ms
									? new Date(automaton.next_run_at_ms as number).toLocaleString()
									: '—'}
							</td>
							<td class="px-4 py-2 text-status-muted">{automaton.last_run_status ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
