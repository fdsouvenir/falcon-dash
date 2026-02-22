<script lang="ts">
	import { get } from 'svelte/store';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import {
		getAgentIdentity,
		connectionState,
		type AgentIdentity
	} from '$lib/stores/agent-identity.js';
	import { sessions } from '$lib/stores/sessions.js';
	import { snapshot, call } from '$lib/stores/gateway.js';
	import { addToast } from '$lib/stores/toast.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	interface AgentEntry {
		agentId: string;
		name: string;
		emoji: string | undefined;
		initial: string;
		sessionCount: number;
		isDefault: boolean;
	}

	let sessionCounts = $state<Record<string, number>>({});
	let defaultAgentId = $state<string>('default');
	let identityMap = new SvelteMap<string, AgentIdentity>();
	let loadingIds = new SvelteSet<string>();
	let modelName = $state<string>('');

	// Subscribe to sessions store, compute counts
	$effect(() => {
		const unsub = sessions.subscribe(($sessions) => {
			const defId = get(snapshot.sessionDefaults).defaultAgentId ?? 'default';
			defaultAgentId = defId;
			const counts: Record<string, number> = { [defId]: 0 };
			for (const s of $sessions) {
				const match = s.sessionKey.match(/^agent:([^:]+):/);
				if (match) counts[match[1]] = (counts[match[1]] ?? 0) + 1;
			}
			sessionCounts = counts;
		});
		return unsub;
	});

	// Fetch identities for newly seen agent IDs
	$effect(() => {
		for (const id of Object.keys(sessionCounts)) {
			if (!identityMap.has(id) && !loadingIds.has(id)) {
				loadingIds.add(id);
				getAgentIdentity(id).then((identity) => {
					identityMap.set(id, identity);
				});
			}
		}
	});

	// Fetch model name on connection
	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'READY') return;
			call<{ model?: string }>('info.status')
				.then((r) => {
					modelName = r.model ?? '';
				})
				.catch(() => {});
		});
		return unsub;
	});

	let agents = $derived<AgentEntry[]>(
		Object.keys(sessionCounts).map((id) => {
			const identity = identityMap.get(id);
			const name = identity?.name || id;
			return {
				agentId: id,
				name,
				emoji: identity?.emoji,
				initial: name.charAt(0).toUpperCase(),
				sessionCount: sessionCounts[id] ?? 0,
				isDefault: id === defaultAgentId
			};
		})
	);
</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-white">Agents</h2>
			<p class="mt-1 text-sm text-gray-400">Manage your connected agents</p>
		</div>
		<button
			onclick={() => addToast('Multi-agent support coming soon', 'info')}
			class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-700 hover:text-white"
			aria-label="Add agent"
			title="Add agent"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
		</button>
	</div>

	<div class="space-y-3">
		{#each agents as agent (agent.agentId)}
			<Card.Root
				class="border-gray-800 bg-gray-900/50 px-4 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900"
			>
				<div class="flex items-center gap-4">
					<Avatar.Root class="h-11 w-11 rounded-xl">
						<Avatar.Fallback class="rounded-xl bg-rose-900/70 text-lg">
							{agent.emoji || agent.initial}
						</Avatar.Fallback>
					</Avatar.Root>

					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate font-semibold text-white">{agent.name}</span>
							{#if agent.isDefault}
								<Badge variant="outline" class="border-amber-700/50 text-amber-400">Default</Badge>
							{/if}
						</div>
						<p class="mt-0.5 text-sm text-gray-400">
							{#if modelName}
								{modelName}
								<span class="mx-1.5 text-gray-600">&middot;</span>
							{/if}
							{agent.sessionCount}
							{agent.sessionCount === 1 ? 'session' : 'sessions'}
						</p>
					</div>

					<span
						class="h-2.5 w-2.5 rounded-full {agent.sessionCount > 0
							? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
							: 'bg-gray-600'}"
					></span>
				</div>
			</Card.Root>
		{/each}

		{#if agents.length === 0}
			<div class="rounded-xl border border-gray-800 bg-gray-900/30 py-12 text-center">
				<p class="text-sm text-gray-500">No agents connected</p>
			</div>
		{/if}
	</div>
</div>
