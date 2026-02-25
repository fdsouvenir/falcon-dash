<script lang="ts">
	import { get } from 'svelte/store';
	import {
		connectionState,
		getAgentIdentity,
		type AgentIdentity
	} from '$lib/stores/agent-identity.js';
	import { sessions, setSelectedAgent } from '$lib/stores/sessions.js';
	import { channelCounts } from '$lib/stores/channels.js';
	import { snapshot } from '$lib/stores/gateway.js';
	import { addToast } from '$lib/stores/toast.js';

	let {
		selectedAgentId = $bindable('default'),
		variant = 'desktop'
	}: { selectedAgentId: string; variant?: 'desktop' | 'mobile' } = $props();

	interface ConfigAgent {
		id: string;
		workspace: string;
		identity?: { name?: string; emoji?: string; theme?: string };
	}

	interface AgentEntry {
		agentId: string;
		name: string;
		emoji: string | undefined;
		initial: string;
		sessionCount: number;
		channelCount: number;
		hasIdentity: boolean;
	}

	// Config agents fetched from /api/agents
	let configAgents = $state<ConfigAgent[]>([]);
	let configHash = $state('');
	let spawning = $state(false);
	let showSpawnConfirm = $state(false);

	// Gateway-sourced identities (name/emoji set by agent itself)
	let gatewayIdentities = $state<Record<string, AgentIdentity>>({});

	// Session counts (written by sessions effect)
	let sessionCounts = $state<Record<string, number>>({});

	// Channel counts
	let chanCounts = $state<Record<string, number>>({});

	$effect(() => {
		const unsub = channelCounts.subscribe((v) => {
			chanCounts = v;
		});
		return unsub;
	});

	async function fetchConfigAgents() {
		try {
			const res = await fetch('/api/agents');
			if (!res.ok) return;
			const data = await res.json();
			if (Array.isArray(data.agents)) {
				configAgents = data.agents;
			}
			if (data.hash) {
				configHash = data.hash;
			}

			// Fetch gateway identities for agents missing config identity
			const toFetch = (data.agents as ConfigAgent[]).filter(
				(a) => !a.identity?.name || !a.identity?.emoji
			);
			const results = await Promise.allSettled(toFetch.map((a) => getAgentIdentity(a.id)));
			const identities: Record<string, AgentIdentity> = {};
			results.forEach((r, i) => {
				if (r.status === 'fulfilled' && r.value.agentId) {
					identities[toFetch[i].id] = r.value;
				}
			});
			gatewayIdentities = identities;
		} catch {
			// Silently fail — rail will be empty until next attempt
		}
	}

	function requestSpawn() {
		if (!configHash || spawning) return;
		showSpawnConfirm = true;
	}

	async function confirmSpawn() {
		showSpawnConfirm = false;
		spawning = true;
		try {
			const res = await fetch('/api/agents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hash: configHash })
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to spawn agent');
			}
			const data = await res.json();
			await fetchConfigAgents();
			addToast(`Agent "${data.agent.id}" created`, 'success');
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Failed to spawn agent', 'error');
		} finally {
			spawning = false;
		}
	}

	// Fetch on mount
	fetchConfigAgents();

	// Re-fetch when connection becomes READY (reconnect)
	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s === 'READY') fetchConfigAgents();
		});
		return unsub;
	});

	// Effect: subscribe to sessions store, compute counts
	$effect(() => {
		const unsub = sessions.subscribe(($sessions) => {
			const counts: Record<string, number> = {};
			for (const s of $sessions) {
				const match = s.sessionKey.match(/^agent:([^:]+):/);
				if (match) counts[match[1]] = (counts[match[1]] ?? 0) + 1;
			}
			sessionCounts = counts;
		});
		return unsub;
	});

	// Derive agents from config, overlay session/channel counts + gateway identities
	let agents = $derived.by(() => {
		// Map config agents as primary source
		const entries: AgentEntry[] = configAgents.map((ca) => {
			const gw = gatewayIdentities[ca.id];
			const name = ca.identity?.name || gw?.name || ca.id;
			const emoji = ca.identity?.emoji || gw?.emoji;
			return {
				agentId: ca.id,
				name,
				emoji,
				initial: name.charAt(0).toUpperCase(),
				sessionCount: sessionCounts[ca.id] ?? 0,
				channelCount: chanCounts[ca.id] ?? 0,
				hasIdentity: !!(ca.identity?.name || gw?.name)
			};
		});

		// Add any session-only agents not in config (edge case: stale sessions)
		const configIds = new Set(configAgents.map((ca) => ca.id));
		for (const id of Object.keys(sessionCounts)) {
			if (!configIds.has(id)) {
				entries.push({
					agentId: id,
					name: id,
					emoji: undefined,
					initial: id.charAt(0).toUpperCase(),
					sessionCount: sessionCounts[id],
					channelCount: chanCounts[id] ?? 0,
					hasIdentity: false
				});
			}
		}

		return entries;
	});

	// Auto-select default agent on connection
	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'READY') return;
			const defaultId = get(snapshot.sessionDefaults).defaultAgentId ?? 'default';
			if (!selectedAgentId || selectedAgentId === 'default') {
				selectedAgentId = defaultId;
				setSelectedAgent(defaultId);
			}
		});
		return unsub;
	});

	let isMobile = $derived(variant === 'mobile');
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static route -->
<div
	class="agent-rail flex shrink-0 flex-col items-center gap-1 pb-3 pt-3"
	class:agent-rail--mobile={isMobile}
>
	<!-- Agent icons -->
	{#each agents as agent (agent.agentId)}
		{@const isActive = selectedAgentId === agent.agentId}
		{@const hasActivity = agent.channelCount > 0 || agent.sessionCount > 0}
		<div class="agent-slot group relative">
			<!-- Active indicator — left edge pill -->
			<div
				class="agent-pill"
				class:agent-pill--active={isActive}
				class:agent-pill--hover={!isActive}
			></div>

			<button
				onclick={() => {
					selectedAgentId = agent.agentId;
					setSelectedAgent(agent.agentId);
				}}
				class="agent-icon"
				class:agent-icon--active={isActive}
				class:agent-icon--mobile={isMobile}
				title={agent.name}
				aria-label="Switch to {agent.name}"
			>
				<span class="agent-icon__label">
					{agent.emoji || agent.initial}
				</span>

				<!-- Online dot — bottom-right -->
				{#if hasActivity}
					<span class="agent-dot" class:agent-dot--active={isActive}></span>
				{/if}
			</button>

			<!-- Tooltip -->
			<div class="agent-tooltip">
				<span class="agent-tooltip__name">{agent.name}</span>
				{#if agent.channelCount > 0}
					<span class="agent-tooltip__count">
						{agent.channelCount} channel{agent.channelCount === 1 ? '' : 's'}
					</span>
				{:else if agent.sessionCount > 0}
					<span class="agent-tooltip__count">
						{agent.sessionCount} session{agent.sessionCount === 1 ? '' : 's'}
					</span>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Separator -->
	{#if agents.length > 0}
		<div class="agent-separator"></div>
	{/if}

	<!-- Spawn agent button + confirm popover -->
	<div class="agent-slot group relative">
		<button
			onclick={requestSpawn}
			disabled={spawning || !configHash}
			class="agent-icon agent-icon--add"
			class:agent-icon--mobile={isMobile}
			aria-label="Spawn new agent"
			title="Spawn new agent"
		>
			{#if spawning}
				<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					></path>
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
			{/if}
		</button>

		{#if showSpawnConfirm}
			<div class="spawn-confirm" role="dialog" aria-label="Confirm spawn">
				<p class="spawn-confirm__text">Spawn agent?</p>
				<div class="spawn-confirm__actions">
					<button
						class="spawn-confirm__btn spawn-confirm__btn--cancel"
						onclick={() => (showSpawnConfirm = false)}
					>
						Cancel
					</button>
					<button class="spawn-confirm__btn spawn-confirm__btn--go" onclick={confirmSpawn}>
						Spawn
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Rail container */
	.agent-rail {
		width: 72px;
		background: color-mix(in oklab, var(--color-gray-900) 94%, black);
		border-right: 1px solid var(--color-gray-800);
	}
	.agent-rail--mobile {
		width: 56px;
	}

	/* Slot — wraps pill + icon + tooltip */
	.agent-slot {
		padding: 2px 0;
	}

	/* Left-edge pill indicator */
	.agent-pill {
		position: absolute;
		left: -1px;
		top: 50%;
		width: 4px;
		border-radius: 0 4px 4px 0;
		background: var(--color-white);
		transition:
			height 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.15s ease;
	}
	.agent-pill--active {
		height: 24px;
		transform: translateY(-50%);
		opacity: 1;
	}
	.agent-pill--hover {
		height: 8px;
		transform: translateY(-50%);
		opacity: 0;
	}
	.group:hover .agent-pill--hover {
		opacity: 1;
	}

	/* Icon button */
	.agent-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-gray-800);
		cursor: pointer;
		position: relative;
		transition:
			border-radius 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
			background-color 0.2s ease,
			box-shadow 0.2s ease;
		border: none;
		color: var(--color-white);
		font-weight: 700;
	}
	.agent-icon--mobile {
		width: 40px;
		height: 40px;
	}
	.agent-icon:hover {
		border-radius: 16px;
		background: var(--color-blue-600);
		box-shadow: 0 2px 12px color-mix(in oklab, var(--color-blue-600) 40%, transparent);
	}
	.agent-icon--active {
		border-radius: 16px;
		background: var(--color-blue-600);
		box-shadow:
			0 2px 12px color-mix(in oklab, var(--color-blue-600) 35%, transparent),
			inset 0 1px 0 color-mix(in oklab, white 10%, transparent);
	}
	.agent-icon--active:hover {
		background: var(--color-blue-500);
	}

	/* Icon label (emoji or initial) */
	.agent-icon__label {
		font-size: 1.125rem;
		line-height: 1;
		user-select: none;
	}
	.agent-icon--mobile .agent-icon__label {
		font-size: 0.9375rem;
	}

	/* Online dot */
	.agent-dot {
		position: absolute;
		bottom: -1px;
		right: -1px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-emerald-500);
		border: 2.5px solid color-mix(in oklab, var(--color-gray-900) 94%, black);
		transition: border-color 0.2s ease;
	}
	.agent-dot--active {
		border-color: color-mix(in oklab, var(--color-blue-600) 100%, black 6%);
	}

	/* Add button */
	.agent-icon--add {
		background: transparent;
		color: var(--color-gray-500);
		border: 2px dashed var(--color-gray-700);
		text-decoration: none;
	}
	.agent-icon--add:hover {
		background: transparent;
		color: var(--color-emerald-400);
		border-color: var(--color-emerald-500);
		box-shadow: 0 2px 12px color-mix(in oklab, var(--color-emerald-500) 25%, transparent);
	}

	/* Tooltip */
	.agent-tooltip {
		position: absolute;
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-left: 14px;
		padding: 6px 10px;
		background: var(--color-gray-950);
		border: 1px solid var(--color-gray-800);
		border-radius: 6px;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 1px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}
	.group:hover .agent-tooltip {
		opacity: 1;
	}
	.agent-tooltip__name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-white);
		line-height: 1.3;
	}
	.agent-tooltip__count {
		font-size: 0.6875rem;
		color: var(--color-gray-400);
		line-height: 1.3;
	}

	/* Separator */
	.agent-separator {
		width: 32px;
		height: 1px;
		background: var(--color-gray-700);
		margin: 4px 0;
		border-radius: 1px;
	}

	/* Spawn confirm popover */
	.spawn-confirm {
		position: absolute;
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-left: 14px;
		padding: 10px 12px;
		background: var(--color-gray-900);
		border: 1px solid var(--color-gray-700);
		border-radius: 8px;
		white-space: nowrap;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 8px;
		box-shadow:
			0 4px 24px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.03);
		animation: spawn-confirm-in 0.12s ease-out;
	}
	@keyframes spawn-confirm-in {
		from {
			opacity: 0;
			transform: translateY(-50%) translateX(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(-50%) translateX(0);
		}
	}
	.spawn-confirm__text {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-gray-300);
		line-height: 1;
	}
	.spawn-confirm__actions {
		display: flex;
		gap: 6px;
	}
	.spawn-confirm__btn {
		padding: 4px 10px;
		border-radius: 5px;
		font-size: 0.6875rem;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
		line-height: 1.4;
	}
	.spawn-confirm__btn--cancel {
		background: transparent;
		color: var(--color-gray-500);
	}
	.spawn-confirm__btn--cancel:hover {
		color: var(--color-gray-300);
	}
	.spawn-confirm__btn--go {
		background: var(--color-emerald-600);
		color: white;
	}
	.spawn-confirm__btn--go:hover {
		background: var(--color-emerald-500);
	}
</style>
