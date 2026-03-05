<script lang="ts">
	import GatewayStatus from './dashboard/GatewayStatus.svelte';
	import AgentCard from './dashboard/AgentCard.svelte';
	import ActivityFeed from './dashboard/ActivityFeed.svelte';
	import QuickActions from './dashboard/QuickActions.svelte';
	import { gatewayEvents } from '$lib/gateway-api.js';

	let sessionCount = $state(0);
	let cronJobCount = $state(0);
	let deviceCount = $state(0);

	$effect(() => {
		const unsub = gatewayEvents.snapshot.subscribe((snap) => {
			const s = snap?.snapshot;
			if (s) {
				sessionCount =
					(s.activeSessions as number | undefined) ??
					((s.sessions as unknown[] | undefined)?.length ?? 0);
				cronJobCount =
					(s.cronJobCount as number | undefined) ??
					((s.cronJobs as unknown[] | undefined)?.length ?? 0);
				deviceCount = (s.presence as unknown[] | undefined)?.length ?? 0;
			}
		});
		return unsub;
	});

	const stats = $derived([
		{ label: 'Sessions', value: sessionCount, color: 'text-status-info' },
		{ label: 'Cron Jobs', value: cronJobCount, color: 'text-status-warning' },
		{ label: 'Devices', value: deviceCount, color: 'text-status-active' },
	]);
</script>

<div class="flex flex-col gap-[var(--space-section-gap)] bg-surface-0 p-5 sm:p-6">
	<!-- Gateway status bar -->
	<GatewayStatus />

	<!-- Stat cards -->
	<div class="grid grid-cols-3 gap-[var(--space-card-gap)]">
		{#each stats as stat (stat.label)}
			<div class="rounded-lg border border-surface-border bg-surface-2 px-[var(--space-card-padding)] py-3">
				<div class="text-[length:var(--text-page-title)] font-bold {stat.color}">
					{stat.value}
				</div>
				<div class="text-[length:var(--text-label)] font-medium text-status-muted">
					{stat.label}
				</div>
			</div>
		{/each}
	</div>

	<!-- Quick actions -->
	<section>
		<h2 class="mb-2.5 text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted">
			Quick Actions
		</h2>
		<QuickActions />
	</section>

	<!-- Agents -->
	<section>
		<h2 class="mb-2.5 text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted">
			Agents
		</h2>
		<AgentCard />
	</section>

	<!-- Activity feed -->
	<section>
		<ActivityFeed />
	</section>
</div>
