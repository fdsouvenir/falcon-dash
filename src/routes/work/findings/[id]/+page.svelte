<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const finding = $derived(data.finding as Record<string, any>);
</script>

<svelte:head><title>{finding.id} — Finding</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-5 p-6">
	<div>
		<a href={resolve('/work')} class="text-xs text-blue-400 hover:underline">← Work v3</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{finding.title}</h1>
			<span class="font-mono text-xs text-status-muted">{finding.id} · v{finding.version}</span>
		</div>
		<p class="text-sm text-white/70">
			<span
				class="font-medium {finding.validity === 'current' ? 'text-emerald-400' : 'text-red-400'}"
				>{finding.validity}</span
			>
			· {finding.confidence}
			· {finding.author}
			{#if finding.observed_at}· observed {new Date(finding.observed_at).toLocaleDateString()}{/if}
		</p>
		<p class="mt-2 text-sm text-white">{finding.conclusion}</p>
		{#if finding.significance}<p class="mt-1 text-sm text-white/80">
				Why it matters: {finding.significance}
			</p>{/if}
		{#if finding.retract_reason}<p class="mt-1 text-sm text-red-300">
				Retracted: {finding.retract_reason}
			</p>{/if}
	</div>

	{#if form && 'error' in form && form.error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			<span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}
		</div>
	{:else if form && 'ok' in form && form.ok}
		<div
			class="rounded border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300"
		>
			{form.command}
			{form.noop ? 'was already done (no-op)' : 'applied'}.
		</div>
	{/if}

	<div class="rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Sources</h2>
		<ul class="mt-2 space-y-1">
			{#each data.sources as source (source.ref)}
				<li class="text-sm">
					<span class="text-white/80">{source.label ?? source.ref}</span>
					<span class="ml-2 font-mono text-xs text-status-muted">{source.kind}:{source.ref}</span>
					{#if source.available}
						<span class="ml-2 text-xs text-emerald-400">available</span>
					{:else}
						<span class="ml-2 text-xs text-red-400">source unavailable ({source.reason})</span>
					{/if}
				</li>
			{/each}
		</ul>
		{#if finding.targets?.length}
			<p class="mt-2 text-xs text-status-muted">Attached to: {finding.targets.join(', ')}</p>
		{/if}
	</div>

	{#if finding.validity === 'current'}
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<form method="POST" action="?/command" use:enhance class="flex gap-2">
				<input type="hidden" name="command" value="retract_finding" />
				<input type="hidden" name="expected_version" value={finding.version} />
				<input
					name="payload_reason"
					placeholder="retraction reason (required)"
					class="w-72 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
				/>
				<button
					class="rounded border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40"
					>Retract</button
				>
			</form>
		</div>
	{/if}

	{#if finding.supersedes || finding.superseded_by}
		<p class="text-xs text-status-muted">
			{#if finding.supersedes}Supersedes <a
					class="text-blue-400"
					href={resolve('/work/findings/[id]', { id: finding.supersedes })}>{finding.supersedes}</a
				>.{/if}
			{#if finding.superseded_by}Superseded by <a
					class="text-blue-400"
					href={resolve('/work/findings/[id]', { id: finding.superseded_by })}
					>{finding.superseded_by}</a
				>.{/if}
		</p>
	{/if}

	{#if finding.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Timeline
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each finding.history as event (event.id)}
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
