<script lang="ts">
	import { resolve } from '$app/paths';
	import { EmptyState, PageHeader, Section, StatusBadge } from '$lib/components/work/index.js';
	import type { PageData } from './$types.js';

	interface AutomatonListItem {
		id: string;
		name: string;
		lifecycle: string;
		health: string;
		health_reason?: string;
		schedule?: Record<string, unknown> | null;
		next_run_at_ms?: number | null;
		last_run_status?: string | null;
	}

	let { data }: { data: PageData } = $props();

	const automata = $derived(data.automata as unknown as AutomatonListItem[]);
	const active = $derived(automata.filter((automaton) => automaton.lifecycle === 'active').length);
	const paused = $derived(automata.filter((automaton) => automaton.lifecycle === 'paused').length);
	const attention = $derived(
		automata.filter((automaton) => ['failing', 'unreachable'].includes(automaton.health)).length
	);
	const deleted = $derived(
		automata.filter((automaton) => automaton.lifecycle === 'deleted').length
	);
	const statusSummary = $derived([
		{ label: 'Active', value: active, tone: 'text-status-active' },
		{ label: 'Paused', value: paused, tone: 'text-status-warning' },
		{ label: 'Needs attention', value: attention, tone: 'text-status-danger' },
		{ label: 'Deleted', value: deleted, tone: 'text-on-surface' }
	]);

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not scheduled';
	}

	function scheduleLabel(schedule?: Record<string, unknown> | null): string {
		if (!schedule) return 'No runtime schedule';
		if (schedule.kind === 'cron') return `Cron ${schedule.expr ?? schedule.cron ?? ''}`.trim();
		if (schedule.kind === 'every')
			return `Every ${schedule.everyMs ?? schedule.interval ?? ''}`.trim();
		if (schedule.kind === 'at') return `Once at ${schedule.at ?? ''}`.trim();
		return JSON.stringify(schedule);
	}
</script>

<svelte:head><title>Automations — Work</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-5">
	<PageHeader title="Automations" />

	{#if data.runtimeError}
		<div
			class="rounded-[var(--md-sys-shape-corner-large)] border border-status-danger/45 bg-status-danger-bg px-4 py-4 text-status-danger"
			role="alert"
		>
			<p class="font-semibold">OpenClaw runtime unreachable</p>
			<p class="mt-1 text-[length:var(--text-label)]">
				Automation health and scheduling could not be read: {data.runtimeError}
			</p>
		</div>
	{/if}

	<div
		class="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-outline-variant/60 sm:grid-cols-4"
		aria-label="Automation status summary"
	>
		{#each statusSummary as item (item.label)}
			<div class="flex min-w-0 items-baseline justify-between gap-3 bg-surface-container px-4 py-3">
				<span class="truncate text-[length:var(--text-label)] font-semibold text-on-surface-variant"
					>{item.label}</span
				>
				<span class="text-xl font-semibold tabular-nums {item.tone}">{item.value}</span>
			</div>
		{/each}
	</div>

	<Section title="All automations" count={automata.length}>
		{#if automata.length === 0}
			<EmptyState
				title={data.runtimeError ? 'Inventory unavailable' : 'No automations'}
				description={data.runtimeError
					? 'The runtime must be reachable before Falcon can render the live inventory.'
					: 'No OpenClaw automation objects currently exist.'}
			/>
		{:else}
			<div class="divide-y divide-outline-variant/60">
				{#each automata as automaton (automaton.id)}
					<a
						href={resolve('/work/automations/[id]', { id: automaton.id })}
						class="falcon-focus touch-target grid gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-2 py-4 hover:bg-surface-container-high md:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)] md:items-center"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="break-words font-semibold text-on-surface">{automaton.name}</h2>
								<StatusBadge type="automaton_lifecycle" value={automaton.lifecycle} />
								<StatusBadge
									type="automaton_health"
									value={automaton.health}
									label={`${automaton.health.replaceAll('_', ' ')} health`}
								/>
							</div>
							<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
								{scheduleLabel(automaton.schedule)}
								{#if automaton.health_reason}
									· {automaton.health_reason}{/if}
							</p>
							<p class="mt-1 font-mono text-[length:var(--text-label)] text-on-surface-variant">
								{automaton.id}
							</p>
						</div>
						<div class="text-left md:text-right">
							<p class="font-medium text-on-surface">{dateLabel(automaton.next_run_at_ms)}</p>
							<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
								Last Run: {automaton.last_run_status ?? 'No Run recorded'}
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</Section>
</div>
