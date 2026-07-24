<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { CommandFeedback, CommandForm } from '$lib/components/work/index.js';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const decision = $derived(data.decision as Record<string, any>);
	const decidable = $derived(decision.status === 'pending' || decision.status === 'deferred');
</script>

<svelte:head><title>{decision.id} — Decision</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-5 p-6">
	<div>
		<a href={resolve('/work')} class="text-xs text-blue-400 hover:underline">← Work v3</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{decision.title}</h1>
			<span class="font-mono text-xs text-status-muted">{decision.id} · v{decision.version}</span>
		</div>
		<p class="text-sm text-white/70">
			<span class="font-medium">{decision.status}</span>
			· deciders: {decision.deciders?.join(', ')}
		</p>
		<p class="mt-2 text-sm text-white">{decision.prompt}</p>
		{#if decision.stakes}<p class="mt-1 text-sm text-white/80">Stakes: {decision.stakes}</p>{/if}
		{#if decision.consequence_of_no_decision}
			<p class="mt-1 text-sm text-amber-200/90">
				If undecided: {decision.consequence_of_no_decision}
			</p>
		{/if}
	</div>

	<CommandFeedback form={form as never} />

	{#if decision.outcome}
		<div class="rounded border border-emerald-800/60 bg-emerald-950/20 p-4">
			<p class="text-xs font-medium uppercase tracking-wide text-emerald-400">Decided</p>
			<p class="mt-1 text-sm text-white">
				<b>{decision.outcome.option_label}</b> — {decision.outcome.rationale}
			</p>
			<p class="mt-1 text-xs text-status-muted">
				{decision.outcome.decided_by?.label} · {new Date(
					decision.outcome.decided_at
				).toLocaleString()}
				· basis: {decision.outcome.authority_basis?.kind}
				{#if decision.outcome.authority_basis?.source_ref}
					({decision.outcome.authority_basis.source_ref.label ??
						decision.outcome.authority_basis.source_ref.ref})
				{/if}
			</p>
		</div>
	{/if}

	<div class="rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Options</h2>
		<ul class="mt-2 space-y-2">
			{#each decision.options as option (option.id)}
				<li
					class="rounded border border-surface-border/60 p-3 {decision.recommendation?.option_id ===
					option.id
						? 'border-blue-700 bg-blue-950/20'
						: ''}"
				>
					<p class="text-sm text-white">
						<b>{option.label}</b>
						{#if decision.recommendation?.option_id === option.id}
							<span class="ml-2 rounded bg-blue-800/60 px-1.5 py-0.5 text-xs text-blue-200"
								>recommended</span
							>
						{/if}
					</p>
					{#if option.summary}<p class="text-xs text-white/70">{option.summary}</p>{/if}
					{#if option.tradeoffs}<p class="text-xs text-status-muted">
							Tradeoffs: {option.tradeoffs}
						</p>{/if}
					{#if decidable}
						<div class="mt-3">
							<CommandForm
								command="decide"
								targetId={decision.id}
								expectedVersion={decision.version}
								form={form as never}
								presetValues={{ option_id: option.id }}
								confirmationSubject={`${option.label} (${option.id})`}
								compact
							/>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		{#if decision.recommendation?.rationale}
			<p class="mt-2 text-xs text-status-muted">
				Recommendation rationale: {decision.recommendation.rationale}
			</p>
		{/if}
	</div>

	{#if decidable}
		<div class="flex flex-wrap gap-3 rounded border border-surface-border bg-surface-1 p-4">
			{#if decision.status === 'pending'}
				<form method="POST" action="?/command" use:enhance class="flex gap-2">
					<input type="hidden" name="command" value="defer_decision" />
					<input type="hidden" name="expected_version" value={decision.version} />
					<input
						name="payload_reason"
						placeholder="defer reason"
						class="w-48 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
					<button
						class="rounded border border-surface-border px-3 py-1.5 text-sm text-white/80 hover:bg-surface-2"
						>Defer</button
					>
				</form>
			{:else}
				<form method="POST" action="?/command" use:enhance>
					<input type="hidden" name="command" value="resume_decision" />
					<input type="hidden" name="expected_version" value={decision.version} />
					<button
						class="rounded border border-surface-border px-3 py-1.5 text-sm text-white/80 hover:bg-surface-2"
						>Resume to pending</button
					>
				</form>
			{/if}
			<div class="min-w-64 flex-1">
				<CommandForm
					command="withdraw_decision"
					targetId={decision.id}
					expectedVersion={decision.version}
					form={form as never}
					compact
				/>
			</div>
		</div>
	{/if}

	{#if decision.supersedes || decision.superseded_by}
		<p class="text-xs text-status-muted">
			{#if decision.supersedes}Supersedes <a
					class="text-blue-400"
					href={resolve('/work/decisions/[id]', { id: decision.supersedes })}
					>{decision.supersedes}</a
				>.{/if}
			{#if decision.superseded_by}Superseded by <a
					class="text-blue-400"
					href={resolve('/work/decisions/[id]', { id: decision.superseded_by })}
					>{decision.superseded_by}</a
				>.{/if}
		</p>
	{/if}

	{#if decision.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Timeline
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each decision.history as event (event.id)}
					<li class="px-4 py-2 text-sm">
						<span class="text-white/80">{event.summary}</span>
						<span class="block text-xs text-status-muted">
							{new Date(event.occurred_at).toLocaleString()} · {event.actor.label}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
