<script lang="ts">
	import { resolve } from '$app/paths';
	import { rpc, gatewayEvents } from '$lib/gateway-api.js';
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
		const unsub = gatewayEvents.state.subscribe((s) => {
			if (s === 'ready') {
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
				const result = await rpc<{
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
	<!-- Skeleton -->
	<div class="grid gap-[var(--space-card-gap)] sm:grid-cols-2 lg:grid-cols-3">
		{#each [1, 2] as i (i)}
			<div
				class="animate-pulse rounded-lg border border-surface-border bg-surface-2 p-[var(--space-card-padding)]"
			>
				<div class="mb-3 flex items-center gap-3">
					<div class="h-10 w-10 rounded-full bg-surface-3"></div>
					<div class="flex-1">
						<div class="mb-1 h-4 w-24 rounded bg-surface-3"></div>
						<div class="h-3 w-16 rounded bg-surface-3/60"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else if agents.length === 0}
	<!-- Empty state -->
	<div
		class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-surface-border bg-surface-1 py-10"
	>
		<div
			class="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-status-muted"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
				/>
			</svg>
		</div>
		<p class="text-[length:var(--text-body)] text-status-muted">No agents configured</p>
		<a
			href={resolve('/settings')}
			class="rounded-md bg-status-info px-3 py-1.5 text-[length:var(--text-badge)] font-semibold text-white transition-colors hover:opacity-90"
		>
			Configure Agent
		</a>
	</div>
{:else}
	<!-- Agent grid -->
	<div class="grid gap-[var(--space-card-gap)] sm:grid-cols-2 lg:grid-cols-3">
		{#each agents as agent (agent.id)}
			{@const identity = getIdentity(agent.id)}
			{@const running = isRunning(agent.id)}
			{@const channels = getChannels()}
			<a
				href={resolve('/agents/[id]', { id: agent.id })}
				class="group rounded-lg border border-surface-border bg-surface-2 p-[var(--space-card-padding)] transition-colors hover:bg-surface-3"
			>
				<!-- Avatar + name -->
				<div class="mb-3 flex items-center gap-3">
					<div
						class="relative flex h-10 w-10 items-center justify-center rounded-full {running
							? 'bg-status-info-bg ring-1 ring-status-info/40'
							: 'bg-surface-3'}"
					>
						{#if identity?.emoji}
							<span class="text-lg">{identity.emoji}</span>
						{:else}
							<span class="text-[length:var(--text-card-title)] font-semibold text-white/80">
								{(identity?.name ?? agent.name ?? agent.id).charAt(0).toUpperCase()}
							</span>
						{/if}
						<span
							class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-2 {running
								? 'bg-status-active'
								: 'bg-status-muted'}"
						></span>
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="truncate text-[length:var(--text-card-title)] font-semibold text-white">
							{identity?.name ?? agent.name ?? agent.id}
						</h3>
						<p class="text-[length:var(--text-label)] text-status-muted">
							{running ? 'Running' : 'Idle'}
							{#if agent.model}
								<span class="text-surface-border"> · </span>
								<span class="font-mono">{agent.model}</span>
							{/if}
						</p>
					</div>
				</div>

				<!-- Channel badges -->
				{#if channels.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each channels as channel (channel)}
							<span
								class="rounded border border-surface-border bg-surface-3 px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] text-status-muted"
							>
								{channel}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-[length:var(--text-badge)] text-status-muted/50">No channels connected</p>
				{/if}
			</a>
		{/each}
	</div>
{/if}
