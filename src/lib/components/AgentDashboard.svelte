<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import ActivityFeed from './dashboard/ActivityFeed.svelte';
	import GatewayStatus from './dashboard/GatewayStatus.svelte';
	import QuickActions from './dashboard/QuickActions.svelte';
	import {
		aggregateChatReadiness,
		aggregateChatSummary,
		channelReadinessLastLoadedAt,
		channelReadinessList,
		channelReadinessLoading,
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
	let channelLoading = $state(false);
	let channelLoadedAt = $state<number | null>(null);
	let connectionState = $state('disconnected');
	let loadingAgents = $state(false);
	let configAgents = $state<ConfigAgent[]>([]);
	let healthAgents = $state<HealthAgent[]>([]);
	let primaryChannelAction = $state<ChannelReadiness | null>(null);
	let loadedForReadyState = false;
	let rebuildToken = 0;
	let identityCache = $state<Record<string, AgentIdentity>>({});

	onMount(() => {
		startChannelReadiness();
		void loadAgents();

		const unsubs = [
			gatewayEvents.state.subscribe((state) => {
				connectionState = state;
				void rebuildAgentSummaries();

				if (state === 'ready') {
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
			channelReadinessLoading.subscribe((value) => {
				channelLoading = value;
			}),
			channelReadinessLastLoadedAt.subscribe((value) => {
				channelLoadedAt = value;
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

				const cachedIdentity = identityCache[id];
				if (cachedIdentity) {
					if (!config?.identity?.name && cachedIdentity.name) name = cachedIdentity.name;
					if (!emoji) emoji = cachedIdentity.emoji;
				}

				if (connectionState === 'ready' && (!config?.identity?.name || !emoji) && !cachedIdentity) {
					const identity = await getAgentIdentity(id);
					identityCache[id] = identity;
					if (!config?.identity?.name && identity.name) name = identity.name;
					if (!emoji) emoji = identity.emoji;
				}

				const status = deriveAgentStatus(health, connectionState);
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

	function deriveAgentStatus(
		health: HealthAgent | undefined,
		state: string
	): {
		label: string;
		detail: string;
		tone: string;
	} {
		if (!health) {
			if (state !== 'ready') {
				return {
					label: 'Offline',
					detail: 'Reconnect the gateway to load live agent health',
					tone: 'border-rose-500/30 bg-rose-500/10 text-rose-100'
				};
			}

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

	function agentSummaryValue(): string {
		if (loadingAgents && configAgents.length === 0) return '…';
		return String(agents.length || configAgents.length);
	}

	function agentSummaryDetail(): string {
		const count = agents.length || configAgents.length;
		if (loadingAgents && count === 0) return 'Loading configured agents';
		if (count === 0) return 'No configured agents';
		if (connectionState !== 'ready') return `${count} configured, live health unavailable`;
		return `${count} configured operators`;
	}

	function approvalsSummaryValue(): string {
		if (connectionState !== 'ready' && approvalsCount === 0) return '—';
		return String(approvalsCount);
	}

	function approvalsSummaryDetail(): string {
		if (approvalsCount > 0) {
			return approvalsCount === 1 ? '1 approval waiting' : `${approvalsCount} approvals waiting`;
		}
		if (connectionState !== 'ready') return 'Reconnect to load the queue';
		return 'No approvals waiting';
	}

	function chatSummaryValue(): string {
		if (connectionState !== 'ready' && channelLoadedAt == null) return 'Unknown';
		return readinessBadge(aggregateState);
	}

	function chatSummaryDetail(): string {
		if (connectionState !== 'ready' && channelLoadedAt == null) {
			return 'Reconnect to load channel readiness';
		}
		if (channelLoading && channelLoadedAt == null) return 'Loading live channel status';
		return aggregateSummary;
	}

	function channelsHeadline(): string {
		if (connectionState !== 'ready' && channelLoadedAt == null) return 'Channels unavailable';
		return aggregateState === 'ready' ? 'Channels ready' : 'Channels need attention';
	}

	function approvalsHeadline(): string {
		if (approvalsCount > 0) return 'Queue needs attention';
		if (connectionState !== 'ready') return 'Approval queue unavailable';
		return 'Queue is clear';
	}

	function channelsSupport(): string {
		if (connectionState !== 'ready' && channelLoadedAt == null) {
			return 'Live channel health appears after the gateway reconnects.';
		}
		if (primaryChannelAction) return primaryChannelAction.detail;
		return aggregateSummary;
	}

	function channelCardTone(channel: ChannelReadiness): string {
		return channel.state === 'ready'
			? 'border-surface-border bg-surface-1/60'
			: readinessTone(channel.state);
	}
</script>

<div class="flex flex-col gap-6 bg-surface-0 p-4 sm:p-6">
	<GatewayStatus />

	<section class="rounded-[2rem] border border-surface-border bg-surface-1/60 px-5 py-5 sm:px-6">
		<div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-xl space-y-2">
				<p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
					Operator Dashboard
				</p>
				<h1 class="text-2xl font-semibold tracking-tight text-white sm:text-[1.9rem]">
					Gateway, agents, channels, and approvals
				</h1>
				<p class="max-w-lg text-sm leading-6 text-white/60">
					Use this page to spot blockers quickly, confirm live health, and jump into the next
					operator action.
				</p>
			</div>
			<div class="grid gap-3 sm:grid-cols-3 lg:min-w-[42rem]">
				<div class="rounded-2xl border border-surface-border bg-surface-0/60 px-4 py-3.5">
					<p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Agents</p>
					<p class="mt-1 text-2xl font-semibold text-white">{agentSummaryValue()}</p>
					<p class="mt-1 text-xs text-white/55">{agentSummaryDetail()}</p>
				</div>
				<div
					class="rounded-2xl border px-4 py-3.5 {connectionState !== 'ready' &&
					channelLoadedAt == null
						? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
						: readinessTone(aggregateState)}"
				>
					<p class="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">Channels</p>
					<p class="mt-1 text-2xl font-semibold">{chatSummaryValue()}</p>
					<p class="mt-1 text-xs opacity-80">{chatSummaryDetail()}</p>
				</div>
				<div
					class="rounded-2xl border px-4 py-3.5 {approvalsCount > 0
						? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
						: 'border-surface-border bg-surface-0/60 text-white/75'}"
				>
					<p class="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">Approvals</p>
					<p class="mt-1 text-2xl font-semibold">{approvalsSummaryValue()}</p>
					<p class="mt-1 text-xs opacity-80">{approvalsSummaryDetail()}</p>
				</div>
			</div>
		</div>
	</section>

	<section class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr),minmax(20rem,0.9fr)] xl:items-start">
		<div class="space-y-4">
			<section class="rounded-3xl border border-surface-border bg-surface-2/70 px-5 py-5">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Agents</p>
						<h2 class="mt-1 text-xl font-semibold text-white">Configured operators</h2>
						<p class="mt-1 text-sm text-white/55">
							Configured agents stay visible even when the gateway is offline.
						</p>
					</div>
					<div class="flex items-center gap-2 text-xs text-white/45">
						{#if loadingAgents}
							<span>Refreshing…</span>
						{/if}
						{#if connectionState !== 'ready'}
							<span
								class="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-100"
							>
								Gateway disconnected
							</span>
						{/if}
					</div>
				</div>
				<div class="mt-4 divide-y divide-surface-border/70">
					{#if loadingAgents && agents.length === 0}
						<div class="py-6 text-sm text-status-muted">Loading configured agents…</div>
					{:else if agents.length === 0}
						<div class="py-6 text-sm text-status-muted">No configured agents found.</div>
					{:else}
						{#each agents as agent (agent.id)}
							<div class="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
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
								<div
									class="flex items-center justify-between gap-3 lg:min-w-[11rem] lg:flex-col lg:items-end"
								>
									<p class="text-xs uppercase tracking-[0.18em] text-white/40 lg:text-right">
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
				<p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Approvals</p>
				<h2 class="mt-1 text-xl font-semibold text-white">{approvalsHeadline()}</h2>
				<p class="mt-1 text-sm text-white/55">
					{approvalsCount > 0
						? 'Resolve waiting approval requests before returning to routine monitoring.'
						: connectionState === 'ready'
							? 'No operator approval requests are waiting right now.'
							: 'Reconnect the gateway to confirm whether approvals are waiting.'}
				</p>
				<div class="mt-4">
					<a
						href={resolve('/approvals')}
						class="flex items-center justify-between rounded-2xl border px-4 py-4 transition hover:bg-surface-1/80 {approvalsCount >
						0
							? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
							: 'border-surface-border bg-surface-1/60 text-white/75'}"
					>
						<div>
							<p class="text-sm font-semibold text-white">
								{approvalsCount > 0
									? approvalsCount === 1
										? '1 approval request waiting'
										: `${approvalsCount} approval requests waiting`
									: connectionState === 'ready'
										? 'No approvals waiting'
										: 'Approval status unavailable'}
							</p>
							<p class="mt-1 text-xs opacity-80">{approvalsSummaryDetail()}</p>
						</div>
						<span class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
							Open queue
						</span>
					</a>
				</div>
			</section>

			<section class="rounded-3xl border border-surface-border bg-surface-2/70 px-5 py-5">
				<p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Channels</p>
				<h2 class="mt-1 text-xl font-semibold text-white">{channelsHeadline()}</h2>
				<p class="mt-1 text-sm text-white/55">{channelsSupport()}</p>
				<div class="mt-4 space-y-3">
					{#each $channelReadinessList as channel (channel.id)}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- readiness cards deep-link to existing local routes -->
						<a
							href={channel.href}
							class="flex items-start justify-between gap-4 rounded-2xl border px-4 py-4 transition hover:bg-surface-1/80 {connectionState !==
								'ready' && channelLoadedAt == null
								? 'border-surface-border bg-surface-1/60'
								: channelCardTone(channel)}"
						>
							<div>
								<div class="flex items-center gap-2">
									<p class="text-sm font-semibold text-white">{channel.label}</p>
									<span
										class="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] {connectionState !==
											'ready' && channelLoadedAt == null
											? 'border-surface-border bg-surface-0/60 text-white/60'
											: readinessTone(channel.state)}"
									>
										{connectionState !== 'ready' && channelLoadedAt == null
											? 'Unavailable'
											: channel.summary}
									</span>
								</div>
								<p class="mt-2 text-sm text-white/70">
									{connectionState !== 'ready' && channelLoadedAt == null
										? 'Reconnect the gateway to load live channel readiness.'
										: channel.detail}
								</p>
							</div>
							<span
								class="rounded-full border border-surface-border bg-surface-0/60 px-4 py-2 text-sm font-semibold text-white/80"
							>
								{connectionState !== 'ready' && channelLoadedAt == null ? 'Open' : channel.ctaLabel}
							</span>
						</a>
					{/each}
				</div>
			</section>

			<section class="rounded-3xl border border-surface-border bg-surface-2/70 px-5 py-5">
				<p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Navigation</p>
				<h2 class="mt-1 text-xl font-semibold text-white">Open a workspace</h2>
				<p class="mt-1 text-sm text-white/55">
					Jump into the operating area you need without using the sidebar.
				</p>
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
