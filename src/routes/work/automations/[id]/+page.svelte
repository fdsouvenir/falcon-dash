<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandFeedback,
		CommandForm,
		DataRow,
		EmptyState,
		PageHeader,
		Section,
		StatusBadge,
		Timeline
	} from '$lib/components/work/index.js';
	import type { ActionData, PageData } from './$types.js';

	interface AutomatonRun {
		ts: number;
		status?: string;
		error?: string;
		summary?: string;
		runId?: string;
	}

	interface AutomatonDetail {
		id: string;
		name: string;
		lifecycle: string;
		health: string;
		health_reason?: string;
		description?: string | null;
		summary?: string | null;
		schedule?: Record<string, unknown> | null;
		payload_summary?: { kind?: string } | null;
		delivery?: Record<string, unknown> | null;
		agent_id?: string | null;
		session_target?: string | null;
		wake_mode?: string | null;
		runtime_updated_at_ms?: number | null;
		next_run_at_ms?: number | null;
		last_run_at_ms?: number | null;
		last_run_error?: string | null;
		last_delivery_status?: string | null;
		area_id?: string | null;
		project_id?: string | null;
		restorable?: boolean;
		restored_from?: string | null;
		runs?: AutomatonRun[];
		history?: Array<Record<string, unknown>>;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const automaton = $derived(data.automaton as unknown as AutomatonDetail);
	const runtimePreset = $derived({
		id: automaton.id,
		...(automaton.runtime_updated_at_ms
			? { expected_runtime_updated_at_ms: String(automaton.runtime_updated_at_ms) }
			: {})
	});
	const restoredId = $derived(
		form && 'result' in form && form.result
			? ((form.result as Record<string, unknown>).id as string | undefined)
			: undefined
	);

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not recorded';
	}

	function jsonLabel(value: unknown): string {
		return value ? JSON.stringify(value) : 'Not configured';
	}
</script>

<svelte:head><title>{automaton.name} — Automations</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-5">
	<PageHeader
		eyebrow="Automation"
		title={automaton.name}
		id={automaton.id}
		status={automaton.lifecycle}
		statusType="automaton_lifecycle"
		description={automaton.summary ?? automaton.description}
		backHref={resolve('/work/automations')}
		backLabel="Automations"
	>
		{#snippet metadata()}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				<StatusBadge
					type="automaton_health"
					value={automaton.health}
					label={`${automaton.health.replaceAll('_', ' ')} health`}
				/>
				{#if automaton.health_reason}
					<span class="text-[length:var(--text-label)] text-on-surface-variant">
						{automaton.health_reason}
					</span>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />
	{#if restoredId && restoredId !== automaton.id}
		<div
			class="rounded-[var(--md-sys-shape-corner-medium)] border border-status-active/40 bg-status-active-bg px-4 py-3 text-status-active"
		>
			The restoration created a new paused runtime object:
			<a
				class="falcon-focus touch-target font-mono font-semibold underline underline-offset-4"
				href={resolve('/work/automations/[id]', { id: restoredId })}
			>
				{restoredId}
			</a>
		</div>
	{/if}

	{#if automaton.last_run_error}
		<div
			class="rounded-[var(--md-sys-shape-corner-large)] border border-status-danger/45 bg-status-danger-bg px-4 py-4 text-status-danger"
			role="alert"
		>
			<p class="font-semibold">Latest runtime failure</p>
			<p class="mt-1 text-[length:var(--text-label)]">{automaton.last_run_error}</p>
		</div>
	{/if}

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
		<div class="space-y-5">
			<Section
				title="Runtime configuration"
				description="Read through from the same OpenClaw object Falcon operates."
			>
				<dl>
					<DataRow label="Schedule" value={jsonLabel(automaton.schedule)} mono />
					<DataRow label="Payload" value={automaton.payload_summary?.kind ?? 'Not configured'} />
					<DataRow label="Delivery" value={jsonLabel(automaton.delivery)} mono />
					<DataRow label="Agent" value={automaton.agent_id ?? 'Runtime default'} mono />
					<DataRow label="Session target" value={automaton.session_target ?? 'Runtime default'} />
					<DataRow label="Wake mode" value={automaton.wake_mode ?? 'Runtime default'} />
				</dl>
			</Section>

			<Section
				title={`Native Run history (${automaton.runs?.length ?? 0})`}
				description="Read directly from OpenClaw; Falcon creates no parallel Run artifact."
			>
				{#if automaton.runs?.length}
					<div class="divide-y divide-outline-variant/60">
						{#each automaton.runs as run, index (run.runId ?? `${run.ts}:${index}`)}
							<div class="grid gap-2 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
								<StatusBadge type="automaton_run" value={run.status ?? 'unknown'} />
								<div class="min-w-0">
									<p class="break-words text-on-surface">
										{run.summary ?? run.error ?? 'No runtime summary'}
									</p>
									{#if run.runId}
										<p
											class="mt-1 font-mono text-[length:var(--text-label)] text-on-surface-variant"
										>
											{run.runId}
										</p>
									{/if}
								</div>
								<time class="text-[length:var(--text-label)] text-on-surface-variant">
									{dateLabel(run.ts)}
								</time>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState
						title="No native Runs"
						description="OpenClaw has not returned Run history for this automation."
					/>
				{/if}
			</Section>

			<Section
				title="Falcon timeline"
				description="Lifecycle and restoration events in Work history."
			>
				{#if automaton.history?.length}
					<Timeline events={automaton.history as never} />
				{:else}
					<EmptyState
						title="No Falcon events"
						description="No Work lifecycle event has been recorded for this automation."
					/>
				{/if}
			</Section>
		</div>

		<div class="space-y-5">
			<Section title="Runtime state" description="Scheduling, delivery, and current placement.">
				<dl>
					<DataRow label="Next Run" value={dateLabel(automaton.next_run_at_ms)} />
					<DataRow label="Last Run" value={dateLabel(automaton.last_run_at_ms)} />
					<DataRow label="Last delivery" value={automaton.last_delivery_status ?? 'Not recorded'} />
					<DataRow label="Runtime updated" value={dateLabel(automaton.runtime_updated_at_ms)} />
					<DataRow label="Area" value={automaton.area_id ?? 'Not assigned'} mono />
					<DataRow label="Project" value={automaton.project_id ?? 'Not assigned'} mono />
					{#if automaton.restored_from}
						<DataRow label="Restored from" value={automaton.restored_from} mono />
					{/if}
				</dl>
			</Section>

			{#if automaton.lifecycle === 'deleted'}
				<Section
					title="Restore deleted Automation"
					description="Recreate a new paused OpenClaw object from the retained snapshot."
					accent="warning"
				>
					{#if automaton.restorable}
						<CommandForm
							command="restore_automaton"
							presetValues={{ id: automaton.id }}
							form={form as never}
							confirmationSubject={automaton.name}
							submitLabel="Restore as paused"
						/>
					{:else}
						<EmptyState
							title="Snapshot unavailable"
							description="This deleted record cannot be restored because no runtime snapshot remains."
						/>
					{/if}
				</Section>
			{:else}
				<Section title="Runtime controls" description="Mutate the same OpenClaw-backed object.">
					<div class="space-y-4">
						{#if automaton.lifecycle === 'paused'}
							<CommandForm
								command="activate_automaton"
								presetValues={runtimePreset}
								form={form as never}
								confirmationSubject={automaton.name}
								compact
							/>
						{:else if automaton.lifecycle === 'active'}
							<CommandForm
								command="pause_automaton"
								presetValues={runtimePreset}
								form={form as never}
								confirmationSubject={automaton.name}
								compact
							/>
						{/if}

						<details class="border-t border-outline-variant/60 pt-3">
							<summary class="falcon-focus touch-target cursor-pointer font-semibold text-primary">
								Edit runtime or Falcon attributes
							</summary>
							<div class="pt-4">
								<CommandForm
									command="update_automaton"
									presetValues={runtimePreset}
									form={form as never}
									confirmationSubject={automaton.name}
								/>
							</div>
						</details>

						<div class="border-t border-outline-variant/60 pt-3">
							<CommandForm
								command="delete_automaton"
								presetValues={{ id: automaton.id }}
								form={form as never}
								confirmationSubject={automaton.name}
								compact
							/>
						</div>
					</div>
				</Section>
			{/if}
		</div>
	</div>
</div>
