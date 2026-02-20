<script lang="ts">
	import SharedAgentRail from '$lib/components/AgentRail.svelte';

	let selectedAgentId = $state('default');
</script>

<SharedAgentRail bind:selectedAgentId variant="mobile" />
