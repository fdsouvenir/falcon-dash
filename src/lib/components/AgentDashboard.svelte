<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import ActivityFeed from './dashboard/ActivityFeed.svelte';
	import GatewayStatus from './dashboard/GatewayStatus.svelte';
	import QuickActions from './dashboard/QuickActions.svelte';
	import {
		aggregateChatReadiness,
		aggregateChatSummary,
		channelReadinessList,
		startChannelReadiness,
		type ChannelReadiness
	} from '$lib/stores/channel-readiness.js';
	import { pendingApprovals } from '$lib/stores/exec-approvals.js';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import { getAgentIdentity, type AgentIdentity } from '$lib/stores/agent-identity.js';

	interface ConfigAgent {
		id: string;
		workspace?: string;
		identity?: { name?: string; emoji?: string };
	}

	interface HealthAgentSessionRecent {
		age?: number;
	}

	interface HealthAgent {
		agentId: string;
		name?: string;
		isDefault?: boolean;
		heartbeat?: {
			enabled?: boolean;
			every?: string;
		};
		sessions?: {
			count?: number;
			recent?: HealthAgentSessionRecent[];
		};
	}

	interface AgentSummary {
		id: string;
		name: string;
		emoji?: string;
		workspace?: string;
		isDefault: boolean;
		heartbeatLabel: string;
		sessionsCount: number;
		lastActivityLabel: string;
		statusLabel: string;
		statusDetail: string;
		statusTone: string;
	}

	let agents = $state<AgentSummary[]>([]);
	let approvalsCount = $state(0);
	let aggregateState = $state('not_configured');
	let aggregateSummary = $state('No chat channels configured');
	let loadingAgents = $state(false);
	let configAgents = $state<ConfigAgent[]>([]);
	let healthAgents = $state<HealthAgent[]>([]);
	let primaryChannelAction = $state<ChannelReadiness | null>(null);
	let loadedForReadyState = false;
	let rebuildToken = 0;
	let identityCache = $state<Record<string, AgentIdentity>>({});

	onMount(() => {
		const unsubs = [
			gatewayEvents.state.subscribe((state) => {
				if (state === 'ready') {
					startChannelReadiness();
					if (!loadedForReadyState) {
						loadedForReadyState = true;
						void loadAgents();
					}
					return;
				}

				loadedForReadyState = false;
			}),
			gatewayEvents.snapshot.subscribe((snapshot) => {
				healthAgents = (snapshot?.snapshot?.health?.agents ?? []) as HealthAgent[];
				void rebuildAgentSummaries();
			}),
			aggregateChatReadiness.subscribe((value) => {
				aggregateState = value;
			}),
			aggregateChatSummary.subscribe((value) => {
				aggregateSummary = value;
			}),
			channelReadinessList.subscribe((value) => {
				primaryChannelAction = value.find((channel) => channel.state !== 'ready') ?? null;
			}),
			pendingApprovals.subscribe((value) => {
				approvalsCount = value.length;
			})
		];

		return () => {
			for (const unsub of unsubs) {
				unsub();
			}
		};
	});

	async function loadAgents(): Promise<void> {
		loadingAgents = true;
		try {
			const res = await fetch('/api/agents');
			if (!res.ok) return;
			const data = await res.json();
			configAgents = (data.agents ?? []) as ConfigAgent[];
			await rebuildAgentSummaries();
		} catch {
			// Keep existing state
		} finally {
			loadingAgents = false;
		}
	}

	async function rebuildAgentSummaries(): Promise<void> {
		const requestToken = ++rebuildToken;
		const currentConfigAgents = configAgents;
		const currentHealthAgents = healthAgents;
		const configById = new Map(currentConfigAgents.map((agent) => [agent.id, agent]));
		const healthById = new Map(currentHealthAgents.map((agent) => [agent.agentId, agent]));
		const agentIds = Array.from(new Set([...configById.keys(), ...healthById.keys()]));

		const nextAgents = await Promise.all(
			agentIds.map(async (id) => {
				const config = configById.get(id);
				const health = healthById.get(id);
				let name = config?.identity?.name ?? health?.name ?? id;
				let emoji = config?.identity?.emoji;

				if (!config?.identity?.name || !emoji) {
					const cachedIdentity = identityCache[id];
					const identity = cachedIdentity ?? (await getAgentIdentity(id));
					if (!cachedIdentity) {
						identityCache[id] = identity;
					}
					if (!config?.identity?.name && identity.name) name = identity.name;
					if (!emoji) emoji = identity.emoji;
				}

				const status = deriveAgentStatus(health);
				return {
					id,
					name,
					emoji,
					workspace: config?.workspace,
					isDefault: Boolean(health?.isDefault),
					heartbeatLabel: health?.heartbeat?.enabled
						? `Heartbeat ${health.heartbeat.every ?? 'enabled'}`
						: 'Heartbeat off',
					sessionsCount: health?.sessions?.count ?? 0,
					lastActivityLabel: formatLastActivity(health?.sessions?.recent?.[0]?.age),
					statusLabel: status.label,
					statusDetail: status.detail,
					statusTone: status.tone
				} satisfies AgentSummary;
			})
		);

		if (requestToken !== rebuildToken) {
			return;
		}

		agents = nextAgents.sort((a, b) => {
			if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
	}

	function deriveAgentStatus(health: HealthAgent | undefined): {
		label: string;
		detail: string;
		tone: string;
	} {
		if (!health) {
			return {
				label: 'Waiting',
				detail: 'Waiting for gateway health data',
				tone: 'border-surface-border bg-surface-1/70 text-white/75'
			};
		}

		const sessionCount = health.sessions?.count ?? 0;
		const latestAge = health.sessions?.recent?.[0]?.age;

		if (typeof latestAge === 'number' && latestAge < 15 * 60 * 1000) {
			return {
				label: 'Active',
				detail: `Recent session ${formatAge(latestAge)} ago`,
				tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
			};
		}

		if (typeof latestAge === 'number' && latestAge < 24 * 60 * 60 * 1000) {
			return {
				label: 'Recent',
				detail: `Last session ${formatAge(latestAge)} ago`,
				tone: 'border-sky-500/30 bg-sky-500/10 text-sky-100'
			};
		}

		if (health.heartbeat?.enabled) {
			return {
				label: 'Heartbeat',
				detail: `Scheduled ${health.heartbeat.every ?? 'enabled'}`,
				tone: 'border-amber-500/30 bg-amber-500/10 text-amber-100'
			};
		}

		if (sessionCount > 0) {
			return {
				label: 'Idle',
				detail: `${sessionCount} recorded sessions`,
				tone: 'border-surface-border bg-surface-1/70 text-white/75'
			};
		}

		return {
			label: 'New',
			detail: 'No sessions recorded yet',
			tone: 'border-surface-border bg-surface-1/70 text-white/75'
		};
	}

	function formatAge(ageMs: number): string {
		const minutes = Math.round(ageMs / 60_000);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.round(hours / 24);
		return `${days}d`;
	}

	function formatLastActivity(ageMs: number | undefined): string {
		if (typeof ageMs !== 'number') return 'No recent session activity';
		return `Last session ${formatAge(ageMs)} ago`;
	}

	function readinessBadge(state: string): string {
		if (state === 'ready') return 'Ready';
		if (state === 'degraded') return 'Degraded';
		if (state === 'misconfigured') return 'Repair';
		if (state === 'needs_input') return 'Needs Input';
		return 'Not Configured';
	}

	function readinessTone(state: string): string {
		if (state === 'ready') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
		if (state === 'degraded') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
		if (state === 'misconfigured') return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
		if (state === 'needs_input') return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
		return 'border-surface-border bg-surface-1/70 text-white/75';
	}
</script>

<div class="flex flex-col gap-6 bg-surface-0 p-4 sm:p-6">
	<GatewayStatus />

	<section
		class="overflow-hidden rounded-[2rem] border border-surface-border bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] px-5 py-6 sm:px-6 sm:py-7"
	>
		<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-2xl space-y-3">
				<p class="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/80">
					Mission Control
				</p>
				<h1 class="text-3xl font-semibold leading-tight text-white sm:text-4xl">
					Operate agents, repair chat, and clear blockers from one surface
				</h1>
				<p class="max-w-xl text-sm leading-6 text-white/70 sm:text-base">
					Falcon Dash is the operator console. The first screen should answer whether chat is ready,
					whether approvals are waiting, and which agents need attention.
				</p>
			</div>
			<div class="grid gap-3 sm:grid-cols-3 lg:min-w-[34rem]">
				<div class="rounded-2xl border border-surface-border bg-surface-1/70 px-4 py-4">
					<p class="text-xs uppercase tracking-[0.18em] text-white/45">Agents</p>
					<p class="mt-1 text-2xl font-semibold text-white">{agents.length}</p>
					<p class="mt-1 text-xs text-white/55">Configured operators</p>
				</div>
				<div class="rounded-2xl border px-4 py-4 {readinessTone(aggregateState)}">
					<p class="text-xs uppercase tracking-[0.18em] opacity-80">Chat</p>
					<p class="mt-1 text-2xl font-semibold">{readinessBadge(aggregateState)}</p>
					<p class="mt-1 text-xs opacity-80">{aggregateSummary}</p>
				</div>
				<div
					class="rounded-2xl border px-4 py-4 {approvalsCount > 0
						? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
						: 'border-surface-border bg-surface-1/70 text-white/75'}"
				>
					<p class="text-xs uppercase tracking-[0.18em] opacity-80">Approvals</p>
					<p class="mt-1 text-2xl font-semibold">{approvalsCount}</p>
					<p class="mt-1 text-xs opacity-80">Requests waiting for operator action</p>
				</div>
			</div>
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-[1.2fr,0.8fr] lg:items-start">
		<div class="space-y-4">
			{#if approvalsCount > 0}
				<a
					href={resolve('/approvals')}
					class="block rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 transition hover:bg-amber-500/15"
				>
					<p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
						Attention
					</p>
					<div class="mt-2 flex items-center justify-between gap-3">
						<div>
							<p class="text-lg font-semibold text-white">{approvalsCount} approvals waiting</p>
							<p class="mt-1 text-sm text-white/70">
								Review and resolve pending operator approvals from the global queue.
							</p>
						</div>
						<span class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
							>Open queue</span
						>
					</div>
				</a>
			{/if}

			{#if aggregateState !== 'ready'}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- shared readiness cards link to known local wizard routes -->
				<a
					href={primaryChannelAction?.href ?? '/channels'}
					class="block rounded-3xl border {readinessTone(
						aggregateState
					)} px-5 py-4 transition hover:opacity-95"
				>
					<p class="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Chat Readiness</p>
					<div class="mt-2 flex items-center justify-between gap-3">
						<div>
							<p class="text-lg font-semibold text-white">
								{primaryChannelAction
									? `${primaryChannelAction.label}: ${primaryChannelAction.summary}`
									: readinessBadge(aggregateState)}
							</p>
							<p class="mt-1 text-sm text-white/75">
								{primaryChannelAction?.detail ?? aggregateSummary}
							</p>
						</div>
						<span class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
							>{primaryChannelAction?.ctaLabel ?? 'Open channels'}</span
						>
					</div>
				</a>
			{/if}

			<section class="rounded-3xl border border-surface-border bg-surface-2/70 px-5 py-5">
				<div class="flex items-center justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Roster</p>
						<h2 class="mt-1 text-xl font-semibold text-white">Agent overview</h2>
					</div>
					{#if loadingAgents}
						<span class="text-xs text-white/45">Refreshing…</span>
					{/if}
				</div>
				<div class="mt-4 divide-y divide-surface-border/70">
					{#if agents.length === 0}
						<div class="py-6 text-sm text-status-muted">No configured agents found.</div>
					{:else}
						{#each agents as agent (agent.id)}
							<div class="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
								<div class="min-w-0 flex items-start gap-3">
									<div
										class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-1 text-base font-semibold text-white"
									>
										{agent.emoji ?? agent.name.charAt(0).toUpperCase()}
									</div>
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											<p class="truncate text-base font-medium text-white">{agent.name}</p>
											{#if agent.isDefault}
												<span
													class="rounded-full border border-surface-border bg-surface-1 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60"
													>Default</span
												>
											{/if}
										</div>
										<p class="truncate text-xs text-white/45">
											{agent.id}{agent.workspace ? ` • ${agent.workspace}` : ''}
										</p>
										<p class="mt-2 text-sm text-white/70">{agent.statusDetail}</p>
										<div class="mt-3 flex flex-wrap gap-2 text-xs">
											<span class="rounded-full border px-3 py-1 font-semibold {agent.statusTone}"
												>{agent.statusLabel}</span
											>
											<span
												class="rounded-full border border-surface-border bg-surface-1/70 px-3 py-1 font-semibold text-white/70"
												>{agent.heartbeatLabel}</span
											>
											<span
												class="rounded-full border border-surface-border bg-surface-1/70 px-3 py-1 font-semibold text-white/70"
												>{agent.sessionsCount} sessions</span
											>
										</div>
									</div>
								</div>
								<div class="flex items-center justify-between gap-3 xl:flex-col xl:items-end">
									<p class="text-xs uppercase tracking-[0.18em] text-white/40">
										{agent.lastActivityLabel}
									</p>
									<a
										href={resolve('/agents/[id]', { id: agent.id })}
										class="rounded-full border border-surface-border px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-surface-1 hover:text-white"
										>Open agent</a
									>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</section>
		</div>

		<div class="space-y-4">
			<section class="rounded-3xl border border-surface-border bg-surface-2/70 px-5 py-5">
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Quick Actions</p>
				<h2 class="mt-1 text-xl font-semibold text-white">High-value operator workflows</h2>
				<div class="mt-4">
					<QuickActions />
				</div>
			</section>

			<section>
				<ActivityFeed />
			</section>
		</div>
	</section>
</div>
