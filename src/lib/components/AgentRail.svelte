<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		getAgentIdentity,
		connectionState,
		type AgentIdentity
	} from '$lib/stores/agent-identity.js';
	import { sessions } from '$lib/stores/sessions.js';
	import { snapshot } from '$lib/stores/gateway.js';

	let {
		selectedAgentId = $bindable('default'),
		variant = 'desktop'
	}: { selectedAgentId: string; variant?: 'desktop' | 'mobile' } = $props();

	interface AgentEntry {
		agentId: string;
		name: string;
		emoji: string | undefined;
		initial: string;
		sessionCount: number;
	}

	let agents = $state<AgentEntry[]>([]);
	let loadedIds = new SvelteSet<string>();

	// Extract unique agent IDs from session keys (format: agent:{agentId}:webchat:dm:{uuid})
	function extractAgentId(sessionKey: string): string | null {
		const match = sessionKey.match(/^agent:([^:]+):/);
		return match ? match[1] : null;
	}

	// Derive agent IDs from sessions + default agent
	$effect(() => {
		const unsub = sessions.subscribe(($sessions) => {
			// Always include default agent
			const defaults = snapshot.sessionDefaults;
			let defaultId = 'default';
			const unsubDefaults = defaults.subscribe((d) => {
				defaultId = d.defaultAgentId ?? 'default';
			});
			unsubDefaults();

			// Collect unique agent IDs and session counts
			const counts: Record<string, number> = {};
			counts[defaultId] = 0;
			for (const s of $sessions) {
				const id = extractAgentId(s.sessionKey);
				if (id) counts[id] = (counts[id] ?? 0) + 1;
			}
			const agentIds = Object.keys(counts);

			// Fetch identities for new agents
			for (const id of agentIds) {
				if (!loadedIds.has(id)) {
					loadedIds.add(id);
					getAgentIdentity(id).then((identity) => {
						updateAgent(id, identity, counts[id] ?? 0);
					});
				}
			}

			// Update session counts for existing agents
			agents = agents.map((a) => ({
				...a,
				sessionCount: counts[a.agentId] ?? 0
			}));
		});
		return unsub;
	});

	function updateAgent(agentId: string, identity: AgentIdentity, sessionCount: number) {
		const name = identity.name || agentId;
		const entry: AgentEntry = {
			agentId,
			name,
			emoji: identity.emoji,
			initial: name.charAt(0).toUpperCase(),
			sessionCount
		};

		agents = agents.some((a) => a.agentId === agentId)
			? agents.map((a) => (a.agentId === agentId ? entry : a))
			: [...agents, entry];
	}

	// Auto-select default agent on connection
	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'CONNECTED') return;
			const defaultsUnsub = snapshot.sessionDefaults.subscribe((d) => {
				const defaultId = d.defaultAgentId ?? 'default';
				if (!selectedAgentId || selectedAgentId === 'default') {
					selectedAgentId = defaultId;
				}
			});
			defaultsUnsub();
		});
		return unsub;
	});

	let railWidth = $derived(variant === 'mobile' ? 'w-14' : 'w-[72px]');
	let iconSize = $derived(variant === 'mobile' ? 'h-10 w-10' : 'h-12 w-12');
	let fontSize = $derived(variant === 'mobile' ? 'text-sm' : 'text-base');
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static route -->
<div
	class="flex {railWidth} shrink-0 flex-col items-center gap-2 border-r border-gray-800 bg-gray-900 pb-3 pt-3"
>
	<!-- Agent icons -->
	{#each agents as agent (agent.agentId)}
		{@const isActive = selectedAgentId === agent.agentId}
		<div class="group relative">
			<!-- Active pill indicator (left edge) -->
			{#if isActive}
				<div
					class="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white"
				></div>
			{:else}
				<div
					class="absolute -left-1 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
				></div>
			{/if}
			<button
				onclick={() => (selectedAgentId = agent.agentId)}
				class="{iconSize} flex items-center justify-center transition-all duration-200 {isActive
					? 'rounded-2xl bg-blue-600'
					: 'rounded-full bg-gray-800 hover:rounded-2xl hover:bg-blue-600/80'} {fontSize} font-bold text-white"
				title={agent.name}
				aria-label="Switch to {agent.name}"
			>
				{agent.emoji || agent.initial}
			</button>

			<!-- Tooltip -->
			<div
				class="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-gray-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
			>
				{agent.name}
				{#if agent.sessionCount > 0}
					<span class="ml-1 text-gray-400">({agent.sessionCount})</span>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Separator -->
	{#if agents.length > 0}
		<div class="h-px w-8 bg-gray-700"></div>
	{/if}

	<!-- Add / settings button -->
	<a
		href="/settings"
		class="{iconSize} flex items-center justify-center rounded-full bg-gray-800 text-green-500 transition-all duration-200 hover:rounded-2xl hover:bg-green-600 hover:text-white"
		aria-label="Agent settings"
		title="Agent settings"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
		</svg>
	</a>
</div>
