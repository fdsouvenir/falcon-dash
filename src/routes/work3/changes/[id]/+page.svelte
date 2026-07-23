<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const change = $derived(data.change as Record<string, any>);
	const plan = $derived(data.plan as Record<string, any> | null);
	const authorized = $derived(change.authorization?.state === 'valid');

	const executionCommands = $derived.by<string[]>(() => {
		// Execution controls appear only when the exact revision has valid
		// Authorization (doc 05).
		switch (change.execution_state) {
			case 'not_started':
				return authorized ? ['start_change', 'cancel_change'] : ['cancel_change'];
			case 'in_progress':
				return ['succeed_execution', 'fail_execution', 'pause_change', 'cancel_change'];
			case 'paused':
				return authorized ? ['resume_change', 'cancel_change'] : ['cancel_change'];
			case 'failed':
				return [...(authorized ? ['retry_change'] : []), 'start_rollback', 'cancel_change'];
			case 'succeeded':
				return ['start_rollback'];
			default:
				return [];
		}
	});

	const verificationCommands = $derived.by<string[]>(() => {
		if (change.execution_state !== 'succeeded' && change.verification_state === 'not_started')
			return [];
		switch (change.verification_state) {
			case 'not_started':
				return ['start_verification', 'waive_verification'];
			case 'in_progress':
				return ['pass_verification', 'fail_verification', 'waive_verification'];
			case 'failed':
				return ['start_verification', 'waive_verification'];
			default:
				return [];
		}
	});

	const commandLabels: Record<string, string> = {
		start_change: 'Start execution',
		pause_change: 'Pause',
		resume_change: 'Resume',
		succeed_execution: 'Record success',
		fail_execution: 'Record failure',
		retry_change: 'Retry',
		cancel_change: 'Cancel change',
		start_verification: 'Start verification',
		pass_verification: 'Pass verification',
		fail_verification: 'Fail verification',
		waive_verification: 'Waive verification',
		start_rollback: 'Start rollback',
		complete_rollback: 'Complete rollback'
	};

	const reasonFields: Record<string, { name: string; placeholder: string }> = {
		succeed_execution: { name: 'result_summary', placeholder: 'result summary (required)' },
		fail_execution: { name: 'failure_summary', placeholder: 'failure summary (required)' },
		cancel_change: { name: 'reason', placeholder: 'reason (required)' },
		fail_verification: { name: 'summary', placeholder: 'what failed (required)' },
		waive_verification: { name: 'reason', placeholder: 'waiver rationale (required)' },
		complete_rollback: { name: 'summary', placeholder: 'rollback summary (required)' }
	};

	function stateColor(state: string): string {
		if (['succeeded', 'passed', 'valid'].includes(state)) return 'text-emerald-400';
		if (['failed', 'revoked', 'invalidated', 'cancelled'].includes(state)) return 'text-red-400';
		if (['in_progress', 'paused', 'waived'].includes(state)) return 'text-amber-400';
		return 'text-white/70';
	}
</script>

<svelte:head><title>{change.id} — Change Request</title></svelte:head>

<div class="mx-auto max-w-4xl space-y-5 p-6">
	<div>
		<a href={resolve('/work3')} class="text-xs text-blue-400 hover:underline">← Work v3</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{change.title}</h1>
			<span class="font-mono text-xs text-status-muted">{change.id} · v{change.version}</span>
		</div>
		{#if change.summary}<p class="mt-1 text-sm text-white/80">{change.summary}</p>{/if}
	</div>

	{#if form && 'error' in form && form.error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			<span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}
			{#if form.error.alternatives?.length}
				<span class="block text-xs">Valid: {form.error.alternatives.join(', ')}</span>
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

	<!-- Execution, verification, and Authorization are separate facts (doc 05). -->
	<div class="grid gap-3 md:grid-cols-3">
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<p class="text-xs font-medium uppercase tracking-wide text-status-muted">Execution</p>
			<p class="mt-1 text-lg font-semibold {stateColor(change.execution_state)}">
				{change.execution_state}
			</p>
			{#if change.result_summary}<p class="text-xs text-white/70">{change.result_summary}</p>{/if}
			{#if change.failure_summary}<p class="text-xs text-red-300">{change.failure_summary}</p>{/if}
		</div>
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<p class="text-xs font-medium uppercase tracking-wide text-status-muted">Verification</p>
			<p class="mt-1 text-lg font-semibold {stateColor(change.verification_state)}">
				{change.verification_state}
			</p>
			{#if change.verification_waived_reason}<p class="text-xs text-amber-300">
					{change.verification_waived_reason}
				</p>{/if}
		</div>
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<p class="text-xs font-medium uppercase tracking-wide text-status-muted">Authorization</p>
			<p class="mt-1 text-lg font-semibold {stateColor(change.authorization?.state)}">
				{change.authorization?.state}
			</p>
			{#if change.authorization?.reason}<p class="text-xs text-red-300">
					{change.authorization.reason}
				</p>{/if}
			<p class="mt-1 text-xs text-status-muted">
				Next: <span class="font-mono">{change.next_action}</span>
			</p>
		</div>
	</div>

	<div class="rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Scope &amp; risk</h2>
		<p class="mt-1 text-sm text-white/80">Allowed: {change.scope_allowed?.join('; ')}</p>
		{#if change.scope_prohibited?.length}
			<p class="text-sm text-red-300/90">Prohibited: {change.scope_prohibited.join('; ')}</p>
		{/if}
		<p class="mt-1 text-xs text-status-muted">Risk: {JSON.stringify(change.risk)}</p>
		<h3 class="mt-3 text-sm font-medium text-white">Acceptance criteria</h3>
		<ul class="mt-1 space-y-1">
			{#each change.acceptance_criteria as criterion (criterion.id)}
				{@const status = change.criteria_status?.[criterion.id]}
				<li class="text-sm">
					<span class="font-mono text-xs text-status-muted">{criterion.id}</span>
					<span class="ml-1 text-white/80">{criterion.text}</span>
					{#if status?.state === 'satisfied'}
						<span class="ml-2 text-xs text-emerald-400">satisfied</span>
					{:else if status?.state === 'waived'}
						<span class="ml-2 text-xs text-amber-400">waived</span>
					{:else}
						<span class="ml-2 text-xs text-status-muted">open</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	{#if plan}
		<div class="rounded border border-surface-border bg-surface-1 p-4">
			<div class="flex items-baseline justify-between">
				<h2 class="text-sm font-medium text-white">
					Plan — revision {plan.revision} ({plan.state})
				</h2>
				<span
					class="text-xs {plan.review_disposition === 'approved'
						? 'text-emerald-400'
						: 'text-status-muted'}"
				>
					Review disposition: {plan.review_disposition}
				</span>
			</div>
			<ol class="mt-2 list-decimal space-y-1 pl-5">
				{#each plan.steps as step, index (index)}
					<li class="text-sm text-white/80">
						{step.step}{#if step.expected_output}<span class="text-xs text-status-muted">
								→ {step.expected_output}</span
							>{/if}
					</li>
				{/each}
			</ol>
			{#if plan.revisions?.length > 1}
				<p class="mt-2 text-xs text-status-muted">
					Revisions: {#each plan.revisions as revision, index (revision.id)}{index > 0
							? ' · '
							: ''}r{revision.revision}
						({revision.state}, {revision.review_disposition}){/each}
				</p>
			{/if}
		</div>
	{/if}

	{#if executionCommands.length > 0 || verificationCommands.length > 0}
		<div class="space-y-3 rounded border border-surface-border bg-surface-1 p-4">
			<h2 class="text-sm font-medium text-white">Actions</h2>
			{#if !authorized && change.execution_state === 'not_started'}
				<p class="text-sm text-amber-300">
					Execution controls are unavailable: Authorization is {change.authorization?.state}.
					{#if change.authorization?.reason}({change.authorization.reason}){/if}
				</p>
			{/if}
			{#each [...executionCommands, ...(change.rollback_started_at && change.execution_state !== 'rolled_back' ? ['complete_rollback'] : []), ...verificationCommands] as command (command)}
				<form
					method="POST"
					action="?/command"
					use:enhance
					class="flex flex-wrap items-center gap-2"
				>
					<input type="hidden" name="command" value={command} />
					<input type="hidden" name="expected_version" value={change.version} />
					{#if reasonFields[command]}
						<input
							name="payload_{reasonFields[command].name}"
							placeholder={reasonFields[command].placeholder}
							class="w-72 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
						/>
					{/if}
					{#if command === 'pass_verification'}
						<input
							name="payload_json_criteria_evidence"
							placeholder={'{"c1":[{"kind":"file","ref":"..."}]}'}
							class="w-96 rounded border border-surface-border bg-surface-2 px-2 py-1 font-mono text-xs text-white"
						/>
					{/if}
					<button
						class="rounded px-3 py-1.5 text-sm font-medium {command.startsWith('cancel') ||
						command.includes('fail')
							? 'border border-red-900 text-red-400 hover:bg-red-950/40'
							: 'bg-blue-600 text-white hover:bg-blue-500'}"
					>
						{commandLabels[command] ?? command}
					</button>
				</form>
			{/each}
		</div>
	{/if}

	{#if change.authorizations?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Authorizations (permission grants — distinct from Reviews)
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each change.authorizations as authorization (authorization.id)}
					<li class="px-4 py-2 text-sm">
						<span class="font-mono text-xs">{authorization.id}</span>
						<span class="ml-2 {stateColor(authorization.effectiveness)}"
							>{authorization.effectiveness}</span
						>
						<span class="ml-2 text-white/70">by {authorization.authorizer}</span>
						<span class="block text-xs text-status-muted">
							basis: {authorization.authority_basis?.kind}
							{#if authorization.authority_basis?.source_ref}
								({authorization.authority_basis.source_ref.label ??
									authorization.authority_basis.source_ref.ref})
							{/if}
							· pinned to revision {authorization.subject_revision?.slice(0, 10)}…
							{#if authorization.effectiveness_reason}· {authorization.effectiveness_reason}{/if}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if change.reviews?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Reviews (evaluations — never execution authority)
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each change.reviews as review (review.id)}
					<li class="px-4 py-2 text-sm">
						<span class="font-mono text-xs">{review.id}</span>
						<span class="ml-2 text-white/80">{review.outcome}</span>
						<span class="ml-2 text-white/70">{review.summary}</span>
						<span class="block text-xs text-status-muted"
							>{review.reviewer} · revision {review.subject_revision?.slice(0, 10)}…</span
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if change.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Timeline
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each change.history as event (event.id)}
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
