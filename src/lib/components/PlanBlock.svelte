<script lang="ts">
	import { Check, Circle } from 'lucide-svelte';
	import type { PlanStep } from '$lib/stores/chat.js';

	let {
		steps = [],
		isStreaming = false
	}: {
		steps: PlanStep[];
		isStreaming?: boolean;
	} = $props();

	let expanded = $state(true);

	function toggle() {
		expanded = !expanded;
	}

	let completedCount = $derived(steps.filter((s) => s.status === 'complete').length);

	let label = $derived(
		isStreaming && completedCount === 0
			? 'Planning...'
			: `Plan \u2014 ${completedCount}/${steps.length} complete`
	);
</script>

{#if steps.length > 0}
	<div
		class="mb-2 rounded-lg border border-gray-700 bg-gray-900 {isStreaming ? 'plan-shimmer' : ''}"
	>
		<button
			onclick={toggle}
			class="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-gray-400 transition-colors hover:text-gray-200 md:py-2"
			aria-expanded={expanded}
		>
			<svg
				class="h-4 w-4 transition-transform md:h-3.5 md:w-3.5 {expanded ? 'rotate-90' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
			<span class="text-xs font-medium">{label}</span>
		</button>

		{#if expanded}
			<div class="border-t border-gray-700 px-4 py-3">
				<ul class="space-y-1.5">
					{#each steps as step, i (i)}
						<li class="flex items-start gap-2.5">
							<!-- Status indicator -->
							{#if step.status === 'complete'}
								<span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
									<Check class="h-3.5 w-3.5 text-green-400" />
								</span>
							{:else if step.status === 'active'}
								<span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
									<span
										class="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]"
									></span>
								</span>
							{:else}
								<span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
									<Circle class="h-2.5 w-2.5 text-gray-600" />
								</span>
							{/if}

							<!-- Step content -->
							<div class="min-w-0">
								<span
									class="text-xs {step.status === 'complete'
										? 'text-gray-500 line-through'
										: step.status === 'active'
											? 'font-medium text-gray-200'
											: 'text-gray-400'}"
								>
									{step.label}
								</span>
								{#if step.description}
									<p class="mt-0.5 text-xs leading-snug text-gray-500">
										{step.description}
									</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<style>
	.plan-shimmer {
		background: linear-gradient(
			90deg,
			rgb(17 24 39) 0%,
			rgb(31 41 55 / 0.6) 50%,
			rgb(17 24 39) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 2s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
