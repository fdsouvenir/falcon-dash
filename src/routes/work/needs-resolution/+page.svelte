<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '../Nav.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Needs Resolution — Work v3</title></svelte:head>

<div class="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
	<h1 class="text-xl font-semibold text-white">Needs Resolution</h1>
	<Nav />

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Open Questions ({data.questions.length})
		</div>
		{#if data.questions.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No open questions.</p>
		{:else}
			<ul class="divide-y divide-surface-border/40">
				{#each data.questions as question (question.id)}
					<li class="px-4 py-2 text-sm">
						<a
							class="text-blue-400 hover:underline"
							href={resolve('/work/questions/[id]', { id: String(question.id) })}
						>
							{question.question}
						</a>
						{#if question.priority}<span class="ml-2 text-xs text-status-muted"
								>{question.priority}</span
							>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Decisions awaiting an outcome ({data.decisions.length})
		</div>
		{#if data.decisions.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No pending decisions.</p>
		{:else}
			<ul class="divide-y divide-surface-border/40">
				{#each data.decisions as decision (decision.id)}
					<li class="px-4 py-2 text-sm">
						<a
							class="text-blue-400 hover:underline"
							href={resolve('/work/decisions/[id]', { id: String(decision.id) })}
						>
							{decision.title}
						</a>
						<span class="ml-2 text-xs text-status-muted">{decision.status}</span>
						{#if decision.consequence_of_no_decision}
							<span class="block text-xs text-amber-300/80"
								>If undecided: {decision.consequence_of_no_decision}</span
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Awaiting Review ({data.awaitingReview.total})
		</div>
		{#if data.awaitingReview.items.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No submitted revisions await review.</p>
		{:else}
			<ul class="divide-y divide-surface-border/40">
				{#each data.awaitingReview.items as item, index (item.id ?? index)}
					<li class="px-4 py-2 text-sm text-white/80">
						{item.title} <span class="ml-2 font-mono text-xs text-status-muted">{item.id}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Changes needing authorization or verification ({data.changesNeeding.total})
		</div>
		{#if data.changesNeeding.items.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No Changes need authority or verification.</p>
		{:else}
			<ul class="divide-y divide-surface-border/40">
				{#each data.changesNeeding.items as item, index (item.id ?? index)}
					<li class="px-4 py-2 text-sm">
						<a
							class="text-blue-400 hover:underline"
							href={resolve('/work/changes/[id]', { id: String(item.id) })}
						>
							{item.title}
						</a>
						<span class="block text-xs text-status-muted">{item.why}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
