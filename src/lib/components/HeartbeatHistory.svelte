<script lang="ts">
	import {
		heartbeatExecutions,
		heartbeatExecutionsLoading,
		loadHeartbeatHistory,
		type HeartbeatExecution
	} from '$lib/stores/heartbeat.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';

	let executions = $state<HeartbeatExecution[]>([]);
	let loading = $state(false);
	let expandedId = $state<string | null>(null);

	$effect(() => {
		const u = heartbeatExecutions.subscribe((v) => {
			executions = v;
		});
		return u;
	});
	$effect(() => {
		const u = heartbeatExecutionsLoading.subscribe((v) => {
			loading = v;
		});
		return u;
	});

	$effect(() => {
		loadHeartbeatHistory();
	});

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<div class="rounded-lg border border-gray-800 bg-gray-900 p-4">
	<h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Recent Heartbeats</h3>

	{#if loading}
		<p class="text-xs text-gray-500">Loading history...</p>
	{:else if executions.length === 0}
		<p class="text-xs text-gray-500">No heartbeat executions yet</p>
	{:else}
		<div class="space-y-2">
			{#each executions as exec (exec.id)}
				<button
					onclick={() => toggleExpand(exec.id)}
					class="w-full rounded border border-gray-800 bg-gray-950 p-3 text-left transition-colors hover:border-gray-700"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							{#if exec.status === 'success'}
								<span class="h-2 w-2 rounded-full bg-green-500"></span>
							{:else}
								<span class="h-2 w-2 rounded-full bg-red-500"></span>
							{/if}
							<span class="text-xs text-white">{formatRelativeTime(exec.timestamp)}</span>
						</div>
						<span class="text-[10px] text-gray-500">
							{exec.checked.length} checked, {exec.surfaced.length} surfaced
							{expandedId === exec.id ? '▼' : '▶'}
						</span>
					</div>
					{#if exec.summary}
						<p class="mt-1 text-xs text-gray-400">{exec.summary}</p>
					{/if}
				</button>

				{#if expandedId === exec.id}
					<div class="ml-4 space-y-2 border-l border-gray-800 pl-4">
						{#if exec.checked.length > 0}
							<div>
								<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500"
									>Checked</span
								>
								<ul class="mt-1 space-y-0.5">
									{#each exec.checked as item, i (i)}
										<li class="text-xs text-gray-400">- {item}</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if exec.surfaced.length > 0}
							<div>
								<span class="text-[10px] font-medium uppercase tracking-wide text-gray-500"
									>Surfaced</span
								>
								<ul class="mt-1 space-y-0.5">
									{#each exec.surfaced as item, i (i)}
										<li class="text-xs text-yellow-400">- {item}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
