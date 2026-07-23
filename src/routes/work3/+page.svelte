<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from './Nav.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- aggregate rows are dynamic records */
	const queue = $derived(data.queue as Record<string, any>);

	function workHref(id: string, type: string): string {
		if (type === 'task') return resolve('/work3/tasks/[id]', { id });
		if (type === 'question') return resolve('/work3/questions/[id]', { id });
		if (type === 'decision') return resolve('/work3/decisions/[id]', { id });
		if (type === 'change_request') return resolve('/work3/changes/[id]', { id });
		if (type === 'project') return resolve('/work3/projects/[id]', { id });
		if (type === 'finding') return resolve('/work3/findings/[id]', { id });
		if (type === 'automaton') return resolve('/work3/automata/[id]', { id });
		return resolve('/work3/browse');
	}

	const sections: Array<{ key: string; title: string; tone: string; empty: string }> = [
		{
			key: 'needs_fred',
			title: 'Needs Fred',
			tone: 'border-amber-800',
			empty: 'Nothing needs your attention.'
		},
		{
			key: 'actionable_now',
			title: 'Agent can act',
			tone: 'border-emerald-900',
			empty: 'No actionable Work is queued.'
		},
		{
			key: 'blocked_risk',
			title: 'Blocked risk',
			tone: 'border-red-900',
			empty: 'Nothing is blocked.'
		},
		{
			key: 'waiting_on_agent',
			title: 'Waiting on agent',
			tone: 'border-surface-border',
			empty: 'Nothing waits on an agent.'
		},
		{
			key: 'waiting_on_external',
			title: 'Waiting on external',
			tone: 'border-surface-border',
			empty: 'Nothing waits on external parties.'
		},
		{
			key: 'awaiting_review',
			title: 'Awaiting Review',
			tone: 'border-surface-border',
			empty: 'No submitted revisions await review.'
		},
		{
			key: 'changes_needing_authorization_or_verification',
			title: 'Changes: authorization / verification',
			tone: 'border-surface-border',
			empty: 'No Changes need authority or verification.'
		},
		{
			key: 'unhealthy_automata',
			title: 'Automation health',
			tone: 'border-red-900',
			empty: 'All Automata are healthy.'
		},
		{
			key: 'needs_reconciliation',
			title: 'Reconciliation',
			tone: 'border-amber-800',
			empty: 'No inconsistencies detected.'
		}
	];
</script>

<svelte:head><title>Mission Control — Work v3</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
	<h1 class="text-xl font-semibold text-white">Mission Control</h1>
	<Nav />

	<div class="grid gap-4 md:grid-cols-2">
		{#each sections as section (section.key)}
			{@const bucketData = queue[section.key]}
			<div class="rounded border {section.tone} bg-surface-1">
				<div
					class="flex items-baseline justify-between border-b border-surface-border/60 px-4 py-2"
				>
					<h2 class="text-sm font-medium text-white">{section.title}</h2>
					<span class="text-xs text-status-muted">{bucketData.total}</span>
				</div>
				{#if bucketData.items.length === 0}
					<p class="px-4 py-3 text-sm text-status-muted">{section.empty}</p>
				{:else}
					<ul class="divide-y divide-surface-border/40">
						{#each bucketData.items as item, index (item.id ?? index)}
							<li class="px-4 py-2 text-sm">
								<a
									class="text-blue-400 hover:underline"
									href={workHref(String(item.id), String(item.type))}
								>
									{item.title ?? item.id}
								</a>
								{#if item.status || item.execution_state}
									<span class="ml-2 text-xs text-status-muted"
										>{item.status ?? item.execution_state}</span
									>
								{/if}
								{#if item.why}
									<span class="block text-xs text-status-muted">{item.why}</span>
								{/if}
							</li>
						{/each}
						{#if bucketData.total > bucketData.items.length}
							<li class="px-4 py-1.5 text-xs text-status-muted">
								+{bucketData.total - bucketData.items.length} more in
								<a class="text-blue-400 hover:underline" href={resolve('/work3/browse')}>Browse</a>
							</li>
						{/if}
					</ul>
				{/if}
			</div>
		{/each}
	</div>

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Material recent changes
		</div>
		{#if data.recentChanges.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No material changes yet.</p>
		{:else}
			<ul class="divide-y divide-surface-border/40">
				{#each data.recentChanges as change (change.id)}
					<li class="px-4 py-2 text-sm">
						<span class="text-white/80">{change.summary}</span>
						{#if change.authority_act}
							<span class="ml-2 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-300"
								>authority act</span
							>
						{/if}
						<span class="block text-xs text-status-muted">
							{new Date(change.at as number).toLocaleString()} · {change.actor}
							{#if (change.authority_sources as unknown[] | undefined)?.length}
								· source: {(change.authority_sources as Array<Record<string, unknown>>)
									.map((source) => source.label ?? `${source.kind}:${source.ref}`)
									.join(' · ')}
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
