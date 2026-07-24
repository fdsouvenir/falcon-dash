<script lang="ts">
	import type { Snippet } from 'svelte';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import Nav from './Nav.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<FalconModuleShell active="Work" eyebrow="Falcon Dash" title="Work" description="Work module">
	<div
		class="mx-auto w-full max-w-[96rem] pb-[max(1rem,var(--safe-bottom))] pl-[max(0.75rem,var(--safe-left))] pr-[max(0.75rem,var(--safe-right))] pt-3 sm:px-5 sm:pt-5"
	>
		<header class="mb-5">
			<Nav />
		</header>
		<div id="work-content">
			{@render children()}
		</div>
	</div>
</FalconModuleShell>
