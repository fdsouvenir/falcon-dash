<script lang="ts">
	import {
		Plan,
		PlanHeader,
		PlanContent,
		PlanTrigger
	} from '$lib/components/ai-elements/plan/index.js';
	import type { PlanStep } from '$lib/stores/chat.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleIcon from '@lucide/svelte/icons/circle';

	let {
		steps = [],
		isStreaming = false
	}: {
		steps: PlanStep[];
		isStreaming?: boolean;
	} = $props();

	let completedCount = $derived(steps.filter((s) => s.status === 'complete').length);

	let label = $derived(
		isStreaming && completedCount === 0
			? 'Planning...'
			: `Plan \u2014 ${completedCount}/${steps.length} complete`
	);
</script>

{#if steps.length > 0}
	<Plan {isStreaming}>
		<PlanHeader>
			<span class="text-sm font-medium text-foreground">{label}</span>
			<PlanTrigger />
		</PlanHeader>
		<PlanContent>
			<ul class="space-y-1.5">
				{#each steps as step, i (i)}
					<li class="flex items-start gap-2.5">
						{#if step.status === 'complete'}
							<span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
								<CheckIcon class="h-3.5 w-3.5 text-green-400" />
							</span>
						{:else if step.status === 'active'}
							<span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
								<span
									class="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]"
								></span>
							</span>
						{:else}
							<span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
								<CircleIcon class="h-2.5 w-2.5 text-muted-foreground" />
							</span>
						{/if}
						<div class="min-w-0">
							<span
								class="text-xs {step.status === 'complete'
									? 'text-muted-foreground line-through'
									: step.status === 'active'
										? 'font-medium text-foreground'
										: 'text-muted-foreground'}"
							>
								{step.label}
							</span>
							{#if step.description}
								<p class="mt-0.5 text-xs leading-snug text-muted-foreground">
									{step.description}
								</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</PlanContent>
	</Plan>
{/if}
