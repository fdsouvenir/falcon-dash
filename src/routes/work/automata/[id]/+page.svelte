<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const automaton = $derived(data.automaton as Record<string, any>);

	function healthColor(health: unknown): string {
		if (health === 'ok') return 'text-emerald-400';
		if (health === 'failing' || health === 'unreachable') return 'text-red-400';
		return 'text-amber-400';
	}
</script>

<svelte:head><title>{automaton.name} — Automaton</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-5 p-6">
	<div>
		<a href={resolve('/work/automata')} class="text-xs text-blue-400 hover:underline">← Automata</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{automaton.name}</h1>
			<span class="font-mono text-xs text-status-muted">{automaton.id}</span>
		</div>
		<p class="text-sm text-white/70">
			<span class="font-medium">{automaton.lifecycle}</span>
			· <span class={healthColor(automaton.health)}>{automaton.health}</span>
			{#if automaton.health_reason}<span class="text-xs text-status-muted"
					>({automaton.health_reason})</span
				>{/if}
		</p>
		{#if automaton.summary}<p class="mt-1 text-sm text-white/80">{automaton.summary}</p>{/if}
		<p class="mt-1 text-xs text-status-muted">
			Schedule: <span class="font-mono">{JSON.stringify(automaton.schedule)}</span>
			· Payload: {automaton.payload_summary?.kind ?? '—'}
			· Wake: {automaton.wake_mode ?? '—'}
			{#if automaton.next_run_at_ms}· Next: {new Date(
					automaton.next_run_at_ms
				).toLocaleString()}{/if}
		</p>
		{#if automaton.restored_from}
			<p class="mt-1 text-xs text-status-muted">
				Restored from <span class="font-mono">{automaton.restored_from}</span>
			</p>
		{/if}
	</div>

	{#if form && 'error' in form && form.error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			<span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}
		</div>
	{:else if form && 'ok' in form && form.ok}
		{@const restoredId = (form.result as Record<string, unknown> | undefined)?.id}
		<div
			class="rounded border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300"
		>
			{form.command}
			{form.noop ? 'was already done (no-op)' : 'applied'}.
			{#if typeof restoredId === 'string' && restoredId !== automaton.id}
				Restored as
				<a class="underline" href={resolve('/work/automata/[id]', { id: restoredId })}
					>{restoredId}</a
				>.
			{/if}
		</div>
	{/if}

	<div class="flex flex-wrap gap-3 rounded border border-surface-border bg-surface-1 p-4">
		{#if automaton.lifecycle === 'paused'}
			<form method="POST" action="?/command" use:enhance>
				<input type="hidden" name="command" value="activate_automaton" />
				<input
					type="hidden"
					name="expected_runtime_updated_at_ms"
					value={automaton.runtime_updated_at_ms ?? ''}
				/>
				<button
					class="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
					>Activate</button
				>
			</form>
		{:else if automaton.lifecycle === 'active'}
			<form method="POST" action="?/command" use:enhance>
				<input type="hidden" name="command" value="pause_automaton" />
				<input
					type="hidden"
					name="expected_runtime_updated_at_ms"
					value={automaton.runtime_updated_at_ms ?? ''}
				/>
				<button
					class="rounded border border-surface-border px-3 py-1.5 text-sm text-white/80 hover:bg-surface-2"
					>Pause</button
				>
			</form>
		{/if}
		{#if automaton.lifecycle !== 'deleted'}
			<form
				method="POST"
				action="?/command"
				use:enhance
				onsubmit={(event) => {
					if (
						!confirm(
							'Delete this Automaton? The runtime job is removed; a restoration snapshot is kept.'
						)
					) {
						event.preventDefault();
					}
				}}
			>
				<input type="hidden" name="command" value="delete_automaton" />
				<button
					class="rounded border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40"
					>Delete</button
				>
			</form>
		{:else if automaton.restorable}
			<form method="POST" action="?/command" use:enhance>
				<input type="hidden" name="command" value="restore_automaton" />
				<button
					class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
					>Restore (paused)</button
				>
			</form>
		{/if}
	</div>

	{#if automaton.runs?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Recent Runs (native OpenClaw history)
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each automaton.runs as run, index (index)}
					<li class="px-4 py-2 text-sm">
						<span
							class={run.status === 'ok'
								? 'text-emerald-400'
								: run.status === 'error'
									? 'text-red-400'
									: 'text-status-muted'}>{run.status}</span
						>
						<span class="ml-2 text-white/80">{run.summary ?? run.error ?? ''}</span>
						<span class="block text-xs text-status-muted">{new Date(run.ts).toLocaleString()}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if automaton.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Falcon timeline
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each automaton.history as event (event.id)}
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
