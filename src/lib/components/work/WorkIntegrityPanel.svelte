<script lang="ts">
	import { Bot, RefreshCw, Send } from '@lucide/svelte';
	import { formatDateTime, formatStatus, type WorkReconciliationRun } from '$lib/work/work-ui.js';

	let {
		runs,
		message,
		statusMessage,
		loading,
		onMessage,
		onRun,
		onForceAgent,
		onAsk
	}: {
		runs: WorkReconciliationRun[];
		message: string;
		statusMessage: string | null;
		loading: boolean;
		onMessage: (message: string) => void;
		onRun: () => void;
		onForceAgent: () => void;
		onAsk: () => void;
	} = $props();

	const latest = $derived(runs[0] ?? null);

	function statusTone(status: WorkReconciliationRun['status']): string {
		if (status === 'failed' || status === 'needs_review') return 'text-status-danger';
		if (status === 'needs_agent' || status === 'agent_running' || status === 'running')
			return 'text-status-warning';
		if (status === 'applied') return 'text-status-active';
		return 'text-on-surface-variant';
	}

	function summary(run: WorkReconciliationRun): string {
		return (
			run.deterministic_changes[0] ??
			run.ambiguities[0] ??
			(run.session_key ? `Session ${run.session_key}` : 'No changes needed')
		);
	}
</script>

<section class="rounded-lg border border-outline-variant/45 bg-surface-0/35 p-4">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="text-sm font-semibold text-on-surface">Work integrity</h3>
			<p class="mt-1 text-xs leading-5 text-on-surface-variant">
				Run mechanical graph checks and route semantic cleanup to the project agent.
			</p>
		</div>
		<Bot class="h-5 w-5 shrink-0 text-primary" />
	</div>

	{#if latest}
		<div class="mt-3 rounded-md border border-outline-variant/40 bg-surface-1/55 p-3">
			<div class="flex flex-wrap items-center gap-2 text-xs">
				<span class={statusTone(latest.status)}>{formatStatus(latest.status)}</span>
				<span class="text-on-surface-variant">{formatDateTime(latest.updated_at)}</span>
			</div>
			<p class="mt-1 line-clamp-3 text-xs leading-5 text-on-surface-variant">{summary(latest)}</p>
			{#if latest.session_key}
				<p class="mt-2 break-all font-mono text-[0.7rem] text-on-surface-variant">
					{latest.session_key}
				</p>
			{/if}
		</div>
	{:else}
		<p
			class="mt-3 rounded-md border border-outline-variant/35 bg-surface-1/45 p-3 text-xs text-on-surface-variant"
		>
			No reconciliation runs recorded yet.
		</p>
	{/if}

	<div class="mt-3 grid gap-2">
		<textarea
			value={message}
			oninput={(event) =>
				onMessage(
					event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget.value : ''
				)}
			rows="3"
			placeholder="Ask the agent in this Work context..."
			class="falcon-focus min-h-20 resize-y rounded-md border border-outline-variant/70 bg-surface-0 px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant"
		></textarea>
		<div class="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
			<button
				type="button"
				disabled={loading}
				onclick={onRun}
				class="falcon-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-outline-variant/70 px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2 disabled:opacity-60"
			>
				<RefreshCw class="h-4 w-4" />
				Check
			</button>
			<button
				type="button"
				disabled={loading}
				onclick={onForceAgent}
				class="falcon-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-outline-variant/70 px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-2 disabled:opacity-60"
			>
				<Bot class="h-4 w-4" />
				Resolve
			</button>
			<button
				type="button"
				disabled={loading}
				onclick={onAsk}
				class="falcon-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
			>
				<Send class="h-4 w-4" />
				Ask
			</button>
		</div>
	</div>

	{#if statusMessage}
		<p class="mt-3 text-xs text-status-active">{statusMessage}</p>
	{/if}
</section>
