<script lang="ts">
	import type { Snippet } from 'svelte';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import Nav from './Nav.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<FalconModuleShell
	active="Work"
	eyebrow="Falcon Dash / Work"
	title="Work control plane"
	description="Operator triage, review, authorization, execution, and evidence across Work v3."
>
	<div
		class="mx-auto w-full max-w-[96rem] pb-[max(1rem,var(--safe-bottom))] pl-[max(0.75rem,var(--safe-left))] pr-[max(0.75rem,var(--safe-right))] pt-3 sm:px-5 sm:pt-5"
	>
		<header class="mb-5 space-y-4">
			<div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p
						class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
					>
						Falcon Dash / Work
					</p>
					<p class="mt-1 text-lg font-semibold text-on-surface">Operator control plane</p>
				</div>
				<p class="text-[length:var(--text-label)] text-on-surface-variant">
					Triage · govern · execute · verify
				</p>
			</div>
			<Nav />
		</header>
		<div id="work-content">
			{@render children()}
		</div>
	</div>
</FalconModuleShell>
