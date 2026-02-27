<script lang="ts">
	import { resolve } from '$app/paths';
	import { connection, call } from '$lib/stores/gateway.js';
	import { getAgentIdentity, type AgentIdentity } from '$lib/stores/agent-identity.js';
	import { discordStatus } from '$lib/stores/discord.js';
	import { SvelteMap } from 'svelte/reactivity';

	interface AgentConfig {
		id: string;
		name?: string;
		emoji?: string;
		model?: string;
	}

	let agents = $state<AgentConfig[]>([]);
	let identities = new SvelteMap<string, AgentIdentity>();
	let activeRuns = $state<Array<{ runId: string; task: string; model: string }>>([]);
	let discord = $state<{ connected: boolean; guildName?: string }>({ connected: false });
	let loading = $state(true);

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			if (s === 'READY') {
				loadAgentData();
			}
		});
		return unsub;
	});

	$effect(() => {
		const unsub = discordStatus.subscribe((s) => {
			discord = s;
		});
		return unsub;
	});

	async function loadAgentData() {
		loading = true;
		try {
			const res = await fetch('/api/agents');
			if (res.ok) {
				const data = await res.json();
				agents = data.agents ?? [];
			}

			for (const agent of agents) {
				try {
					const identity = await getAgentIdentity(agent.id);
					identities.set(agent.id, identity);
				} catch {
					// identity unavailable
				}
			}

			try {
				const result = await call<{
					active?: Array<{ runId: string; task: string; model: string }>;
				}>('agents.list');
				activeRuns = result.active ?? [];
			} catch {
				// RPC unavailable
			}
		} finally {
			loading = false;
		}
	}

	function getIdentity(agentId: string): AgentIdentity | undefined {
		return identities.get(agentId);
	}

	function isRunning(agentId: string): boolean {
		return activeRuns.some((r) => r.task?.includes(agentId) || r.runId?.includes(agentId));
	}

	function getChannels(): string[] {
		const channels: string[] = [];
		if (discord.connected) channels.push('Discord');
		return channels;
	}
</script>

{#if loading && agents.length === 0}
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each [1, 2] as i (i)}
			<div class="animate-pulse rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
				<div class="mb-3 flex items-center gap-3">
					<div class="h-10 w-10 rounded-full bg-gray-700"></div>
					<div class="flex-1">
						<div class="mb-1 h-4 w-24 rounded bg-gray-700"></div>
						<div class="h-3 w-16 rounded bg-gray-700/60"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else if agents.length === 0}
	<div
		class="flex flex-col items-center gap-3 rounded-lg border border-gray-700/40 border-dashed bg-gray-800/20 py-10"
	>
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-gray-500">
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
				/>
			</svg>
		</div>
		<p class="text-sm text-gray-400">No agents configured</p>
		<a
			href={resolve('/settings')}
			class="rounded-md bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
		>
			Configure Agent
		</a>
	</div>
{:else}
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each agents as agent (agent.id)}
			{@const identity = getIdentity(agent.id)}
			{@const running = isRunning(agent.id)}
			{@const channels = getChannels()}
			<a
				href={resolve('/agents/[id]', { id: agent.id })}
				class="group rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 transition-colors hover:border-gray-600/80 hover:bg-gray-800/60"
			>
				<div class="mb-3 flex items-center gap-3">
					<div
						class="relative flex h-10 w-10 items-center justify-center rounded-full {running
							? 'bg-blue-600/20 ring-1 ring-blue-500/40'
							: 'bg-gray-700/60'}"
					>
						{#if identity?.emoji}
							<span class="text-lg">{identity.emoji}</span>
						{:else}
							<span class="text-sm font-semibold text-gray-300">
								{(identity?.name ?? agent.name ?? agent.id).charAt(0).toUpperCase()}
							</span>
						{/if}
						<span
							class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-800 {running
								? 'bg-emerald-400'
								: 'bg-gray-500'}"
						></span>
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="truncate text-sm font-semibold text-gray-100">
							{identity?.name ?? agent.name ?? agent.id}
						</h3>
						<p class="text-xs text-gray-500">
							{running ? 'Running' : 'Idle'}
							{#if agent.model}
								<span class="text-gray-600"> · </span>
								<span class="font-mono">{agent.model}</span>
							{/if}
						</p>
					</div>
				</div>

				{#if channels.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each channels as channel (channel)}
							<span
								class="rounded border border-gray-600/40 bg-gray-700/30 px-1.5 py-0.5 text-[11px] text-gray-400"
							>
								{channel}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-[11px] text-gray-600">No channels connected</p>
				{/if}
			</a>
		{/each}
	</div>
{/if}
