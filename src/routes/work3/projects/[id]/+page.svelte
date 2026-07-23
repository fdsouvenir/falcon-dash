<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const project = $derived(data.project as Record<string, any>);

	const lifecycleCommands = $derived.by<string[]>(() => {
		if (project.archived) return ['restore_project'];
		switch (project.status) {
			case 'draft':
				return ['plan_project', 'cancel_project'];
			case 'planned':
				return ['activate_project', 'cancel_project'];
			case 'active':
				return ['pause_project', 'complete_project', 'cancel_project'];
			case 'paused':
				return ['activate_project', 'cancel_project'];
			case 'completed':
			case 'cancelled':
				return ['reopen_project', 'archive_project'];
			default:
				return [];
		}
	});

	const commandLabels: Record<string, string> = {
		plan_project: 'Mark planned',
		activate_project: 'Activate',
		pause_project: 'Pause',
		complete_project: 'Complete project',
		cancel_project: 'Cancel project',
		reopen_project: 'Reopen',
		archive_project: 'Archive',
		restore_project: 'Restore from archive'
	};

	function healthColor(health: string): string {
		if (health === 'on_track') return 'text-emerald-400';
		if (health === 'blocked') return 'text-red-400';
		if (health === 'at_risk') return 'text-amber-400';
		return 'text-status-muted';
	}

	function workHref(id: string): string {
		if (id.startsWith('t')) return resolve('/work3/tasks/[id]', { id });
		if (id.startsWith('q')) return resolve('/work3/questions/[id]', { id });
		if (id.startsWith('d')) return resolve('/work3/decisions/[id]', { id });
		if (id.startsWith('c')) return resolve('/work3/changes/[id]', { id });
		return resolve('/work3');
	}
</script>

<svelte:head><title>{project.id} — Project</title></svelte:head>

<div class="mx-auto max-w-4xl space-y-5 p-6">
	<!-- Header: outcome, lifecycle, health, progress, current-next (doc 05). -->
	<div>
		<a href={resolve('/work3')} class="text-xs text-blue-400 hover:underline">← Work v3</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{project.title}</h1>
			<span class="font-mono text-xs text-status-muted">{project.id} · v{project.version}</span>
			{#if project.archived}<span
					class="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-status-muted">archived</span
				>{/if}
		</div>
		<p class="text-sm text-white/70">
			<span class="font-medium">{project.status}</span>
			· <span class={healthColor(project.health)}>{project.health}</span>
			<span class="text-xs text-status-muted">({project.health_reason})</span>
		</p>
		{#if project.desired_outcome}<p class="mt-1 text-sm text-white">
				Outcome: {project.desired_outcome}
			</p>{/if}
		{#if project.why_it_matters}<p class="mt-1 text-sm text-white/70">
				{project.why_it_matters}
			</p>{/if}
		<p class="mt-2 text-xs text-status-muted">
			Criteria {project.progress.criteria} · Milestones {project.progress.milestones} · Open work
			{project.progress.work_open} · Blocked {project.progress.work_blocked}
		</p>
		{#if project.current_next_item_id}
			<p class="mt-1 text-sm text-blue-300">
				Next:
				<a class="hover:underline" href={workHref(project.current_next_item_id)}
					>{project.current_next_item_id}</a
				>
			</p>
		{:else if project.status === 'active'}
			<p class="mt-1 text-sm text-amber-300">No current next item — pick one below.</p>
		{/if}
	</div>

	{#if form && 'error' in form && form.error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			<span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}
			{#if form.error.details?.missing}<span class="block text-xs"
					>Missing: {JSON.stringify(form.error.details.missing)}</span
				>{/if}
			{#if form.error.alternatives?.length}<span class="block text-xs"
					>Try: {form.error.alternatives.join(', ')}</span
				>{/if}
		</div>
	{:else if form && 'ok' in form && form.ok}
		<div
			class="rounded border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300"
		>
			{form.command}
			{form.noop ? 'was already done (no-op)' : 'applied'}.
		</div>
	{/if}

	<!-- Proof: criteria with contribution vs satisfaction distinguished. -->
	<div class="rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Completion criteria</h2>
		{#if project.completion_criteria.length === 0}
			<p class="mt-1 text-sm text-status-muted">No criteria defined yet.</p>
		{:else}
			<ul class="mt-2 space-y-1">
				{#each project.completion_criteria as criterion (criterion.id)}
					<li class="text-sm">
						<span class="font-mono text-xs text-status-muted">{criterion.id}</span>
						<span class="ml-1 text-white/80">{criterion.text}</span>
						{#if criterion.satisfied}
							<span class="ml-2 text-xs text-emerald-400">satisfied</span>
						{:else if criterion.waived}
							<span class="ml-2 text-xs text-amber-400" title={criterion.waived.reason}>waived</span
							>
						{:else}
							<span class="ml-2 text-xs text-status-muted">open</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if project.scope_included?.length || project.scope_excluded?.length}
			<p class="mt-2 text-xs text-status-muted">
				In scope: {project.scope_included.join('; ') || '—'}
				{#if project.scope_excluded?.length}· Out: {project.scope_excluded.join('; ')}{/if}
			</p>
		{/if}
	</div>

	<!-- Route: ordered Phases. -->
	{#if project.phases?.length}
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<h2 class="text-sm font-medium text-white">Route</h2>
			<ol class="mt-2 space-y-1">
				{#each project.phases as phase (phase.id)}
					<li class="text-sm">
						<span class="font-mono text-xs text-status-muted">#{phase.sequence}</span>
						<span class="ml-1 text-white/80">{phase.title}</span>
						<span
							class="ml-2 text-xs {phase.status === 'active'
								? 'text-emerald-400'
								: 'text-status-muted'}">{phase.status}</span
						>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<!-- Proof: Milestones with derived schedule state. -->
	{#if project.milestones?.length}
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<h2 class="text-sm font-medium text-white">Milestones</h2>
			<ul class="mt-2 space-y-1">
				{#each project.milestones as milestone (milestone.id)}
					<li class="text-sm">
						<span class="text-white/80">{milestone.title}</span>
						<span
							class="ml-2 text-xs {milestone.status === 'achieved'
								? 'text-emerald-400'
								: 'text-status-muted'}"
						>
							{milestone.status}{milestone.schedule_state !== 'none' &&
							milestone.schedule_state !== 'achieved'
								? ` · ${milestone.schedule_state}`
								: ''}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Current work in Project context. -->
	{#if project.work?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Work
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each project.work as item (item.id)}
					<li class="flex items-center gap-2 px-4 py-2 text-sm">
						<a class="text-blue-400 hover:underline" href={workHref(item.id)}>{item.id}</a>
						<span class="text-white/80">{item.title}</span>
						<span class="text-xs text-status-muted">{item.status}</span>
						{#if project.status !== 'completed' && project.status !== 'cancelled' && !['completed', 'cancelled'].includes(item.status)}
							<form method="POST" action="?/command" use:enhance class="ml-auto">
								<input type="hidden" name="command" value="set_current_next_item" />
								<input type="hidden" name="expected_version" value={project.version} />
								<input type="hidden" name="payload_item_id" value={item.id} />
								<button
									class="rounded border border-surface-border px-2 py-0.5 text-xs text-white/70 hover:bg-surface-2"
								>
									Set as next
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="space-y-3 rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Actions</h2>
		{#each lifecycleCommands as command (command)}
			<form method="POST" action="?/command" use:enhance class="flex flex-wrap items-center gap-2">
				<input type="hidden" name="command" value={command} />
				<input type="hidden" name="expected_version" value={project.version} />
				{#if command === 'activate_project' && !project.plan_id}
					<input
						name="payload_plan_not_required_reason"
						placeholder="plan-not-required reason"
						class="w-64 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				{#if command === 'complete_project'}
					<input
						name="payload_outcome_summary"
						placeholder="outcome summary (required)"
						class="w-72 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				{#if command === 'cancel_project'}
					<input
						name="payload_reason"
						placeholder="reason"
						class="w-48 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
					<input
						name="payload_child_disposition"
						placeholder="child work disposition"
						class="w-56 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				{#if command === 'reopen_project'}
					<input
						name="payload_reason"
						placeholder="reason"
						class="w-48 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
					<input
						name="payload_current_next_item_id"
						placeholder="new next item id"
						class="w-40 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
					/>
				{/if}
				<button
					class="rounded px-3 py-1.5 text-sm font-medium {command === 'cancel_project'
						? 'border border-red-900 text-red-400 hover:bg-red-950/40'
						: 'bg-blue-600 text-white hover:bg-blue-500'}"
				>
					{commandLabels[command] ?? command}
				</button>
			</form>
		{/each}
	</div>

	{#if project.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				History
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each project.history as event (event.id)}
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
