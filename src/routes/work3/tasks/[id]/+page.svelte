<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const task = $derived(data.task as Record<string, any>);

	function preserved(command: string, field: string): string {
		if (form && 'values' in form && form.command === command) {
			return form.values?.[`payload_${field}`] ?? '';
		}
		return '';
	}

	const commandLabels: Record<string, string> = {
		ready_task: 'Mark ready',
		start_task: 'Start work',
		wait_task: 'Mark waiting',
		resume_task: 'Resume',
		submit_task_for_review: 'Submit for review',
		accept_task: 'Accept output',
		complete_task: 'Complete',
		cancel_task: 'Cancel task',
		reopen_task: 'Reopen',
		update_task: 'Save edits'
	};

	const isVersionConflict = $derived(
		form && 'error' in form && form.error?.code === 'version_conflict'
	);
</script>

<svelte:head><title>{task.id} — Work v3</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-5 p-6">
	<div>
		<a href={resolve('/work3')} class="text-xs text-blue-400 hover:underline">← Work v3</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{task.title}</h1>
			<span class="font-mono text-xs text-status-muted">{task.id} · v{task.version}</span>
		</div>
		<p class="text-sm text-white/70">
			<span class="font-medium">{task.status}</span>
			· {task.actionability}
			{#if task.owner}· owner {task.owner}{/if}
			{#if task.priority}· {task.priority}{/if}
		</p>
		{#if task.summary}<p class="mt-1 text-sm text-white/80">{task.summary}</p>{/if}
		{#if task.completion_condition}
			<p class="mt-1 text-xs text-status-muted">Done when: {task.completion_condition}</p>
		{/if}
		{#if task.result_summary}
			<p class="mt-1 text-sm text-emerald-300">Result: {task.result_summary}</p>
		{/if}
	</div>

	{#if form && 'error' in form && form.error}
		<div
			class="space-y-1 rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300"
		>
			<p><span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}</p>
			{#if isVersionConflict}
				<p class="text-xs">
					This task changed while you were editing (now v{form.current_version}). Your input is
					preserved below —
					<button class="underline" onclick={() => invalidateAll()}>refresh</button> and reapply.
				</p>
			{/if}
			{#if form.error.alternatives?.length}
				<p class="text-xs">Valid next actions: {form.error.alternatives.join(', ')}</p>
			{/if}
		</div>
	{:else if form && 'ok' in form && form.ok}
		<div
			class="rounded border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300"
		>
			{form.command}
			{form.noop ? 'was already done (no-op)' : 'applied'}.
		</div>
	{/if}

	{#if task.waiting}
		<div class="rounded border border-amber-800 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
			Waiting on <b>{task.waiting.waiting_on}</b>: {task.waiting.reason}
			<span class="block text-xs">Resumes when: {task.waiting.resume_condition}</span>
		</div>
	{/if}

	{#if task.active_blockers?.length}
		<div class="rounded border border-red-900 bg-red-950/30 px-4 py-2">
			<p class="text-sm font-medium text-red-300">Blocked</p>
			{#each task.active_blockers as blocker (blocker.id)}
				<p class="text-sm text-red-200">
					{blocker.reason}
					<span class="block text-xs text-red-300/80"
						>Clears when: {blocker.resolution_condition}</span
					>
				</p>
			{/each}
		</div>
	{/if}

	<div class="space-y-3 rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Actions</h2>
		{#each data.legalCommands.filter((c) => c !== 'update_task') as command (command)}
			<form method="POST" action="?/command" use:enhance class="flex flex-wrap items-center gap-2">
				<input type="hidden" name="command" value={command} />
				<input type="hidden" name="expected_version" value={task.version} />
				{#if command === 'ready_task' && !task.owner}
					<input
						name="payload_owner"
						placeholder="owner (required)"
						value={preserved(command, 'owner')}
						class="rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				{#if command === 'wait_task'}
					<input
						name="payload_waiting_on"
						placeholder="waiting on"
						value={preserved(command, 'waiting_on')}
						class="rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
					<input
						name="payload_reason"
						placeholder="reason"
						value={preserved(command, 'reason')}
						class="rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
					<input
						name="payload_resume_condition"
						placeholder="resume when…"
						value={preserved(command, 'resume_condition')}
						class="rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				{#if command === 'submit_task_for_review' || command === 'complete_task'}
					<input
						name="payload_result_summary"
						placeholder="result summary"
						value={preserved(command, 'result_summary')}
						class="w-64 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				{#if command === 'cancel_task' || command === 'reopen_task'}
					<input
						name="payload_reason"
						placeholder="reason (required)"
						value={preserved(command, 'reason')}
						class="w-64 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				<button
					class="rounded px-3 py-1.5 text-sm font-medium {command === 'cancel_task'
						? 'border border-red-900 text-red-400 hover:bg-red-950/40'
						: 'bg-blue-600 text-white hover:bg-blue-500'}"
				>
					{commandLabels[command] ?? command}
				</button>
			</form>
		{/each}
		{#if data.legalCommands.length === 0}
			<p class="text-sm text-status-muted">No actions available in this state.</p>
		{/if}
	</div>

	{#if task.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Timeline
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each task.history as event (event.id)}
					<li class="px-4 py-2 text-sm">
						<span class="text-white/80">{event.summary}</span>
						<span class="block text-xs text-status-muted">
							{new Date(event.occurred_at).toLocaleString()} · {event.actor.label} ·
							<span class="font-mono">{event.event_type}</span>
							{#if event.version_from !== null}· v{event.version_from}→v{event.version_to}{/if}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
