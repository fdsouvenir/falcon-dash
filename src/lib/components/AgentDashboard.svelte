<script lang="ts">
	import GatewayStatus from './dashboard/GatewayStatus.svelte';
	import AgentCard from './dashboard/AgentCard.svelte';
	import ActivityFeed from './dashboard/ActivityFeed.svelte';
	import QuickActions from './dashboard/QuickActions.svelte';
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<!-- Gateway connection status -->
	<GatewayStatus />

	<!-- Agent cards -->
	<section>
		<h2 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">Agents</h2>
		<AgentCard />
	</section>

	<!-- Quick actions -->
	<section>
		<h2 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
			Quick Actions
		</h2>
		<QuickActions />
	</section>

	<!-- Activity feed -->
	<section>
		<ActivityFeed />
	</section>
</div>
