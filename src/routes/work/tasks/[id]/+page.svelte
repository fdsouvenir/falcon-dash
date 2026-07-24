<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		BlockerList,
		CommandBar,
		CommandFeedback,
		DataRow,
		PageHeader,
		Section,
		StatusBadge,
		Timeline,
		WaitingBanner
	} from '$lib/components/work/index.js';
	import type { ActionData, PageData } from './$types.js';

	interface TaskDetail {
		id: string;
		title: string;
		status: string;
		actionability?: string;
		owner?: string | null;
		priority?: string | null;
		area_id?: string | null;
		project_id?: string | null;
		due_at?: number | null;
		version: number;
		summary?: string | null;
		completion_condition?: string | null;
		result_summary?: string | null;
		output_revision?: number;
		completed_at?: number | null;
		cancelled_at?: number | null;
		cancel_reason?: string | null;
		created_at?: number | null;
		updated_at?: number | null;
		waiting?: {
			waiting_on?: string;
			reason?: string;
			resume_condition?: string;
			follow_up_at?: number | null;
		} | null;
		active_blockers?: Array<{
			id?: string;
			reason?: string;
			resolution_condition?: string;
			severity?: string;
		}>;
		history?: Array<{
			id?: string;
			occurred_at?: number;
			summary?: string;
			event_type?: string;
			command?: string;
			version_from?: number | null;
			version_to?: number | null;
			actor?: { label?: string; kind?: string };
			authority_act?: boolean;
			source_refs?: unknown[];
		}>;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const task = $derived(data.task as unknown as TaskDetail);
	const forceRequiredByCommand = $derived({
		ready_task: task.owner ? [] : ['owner'],
		complete_task: task.result_summary ? [] : ['result_summary']
	});

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not set';
	}
</script>

<svelte:head><title>{task.title} — Work</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5">
	<PageHeader
		eyebrow="Task"
		title={task.title}
		id={task.id}
		version={task.version}
		status={task.status}
		statusType="task"
		description={task.summary}
		backHref={resolve('/work/browse?type=task')}
		backLabel="Browse tasks"
	>
		{#snippet metadata()}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				{#if task.priority}
					<StatusBadge type="priority" value={task.priority} label={`${task.priority} priority`} />
				{/if}
				{#if task.actionability}
					<span class="text-[length:var(--text-label)] text-on-surface-variant">
						{task.actionability.replaceAll('_', ' ')}
					</span>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />

	{#if task.waiting}<WaitingBanner waiting={task.waiting} />{/if}
	<BlockerList blockers={task.active_blockers ?? []} />

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)]">
		<div class="space-y-5">
			<Section
				title="Definition and outcome"
				description="The task contract and the latest recorded result."
			>
				<dl>
					<DataRow label="Summary" value={task.summary ?? 'No summary recorded.'} />
					<DataRow
						label="Done when"
						value={task.completion_condition ?? 'No completion condition recorded.'}
					/>
					<DataRow label="Result" value={task.result_summary ?? 'No result recorded yet.'} />
					<DataRow label="Output revision" value={task.output_revision ?? 0} />
				</dl>
			</Section>

			{#if task.history?.length}
				<Section
					title="Timeline"
					description="Immutable command history, actors, and version transitions."
				>
					<Timeline events={task.history} />
				</Section>
			{/if}
		</div>

		<Section title="Operating context" description="Ownership, placement, and timing.">
			<dl>
				<DataRow label="Owner" value={task.owner ?? 'Unassigned'} />
				<DataRow label="Priority">
					<StatusBadge type="priority" value={task.priority} />
				</DataRow>
				<DataRow label="Area" value={task.area_id ?? 'Not assigned'} mono />
				<DataRow label="Project" value={task.project_id ?? 'Not assigned'} mono />
				<DataRow label="Due" value={dateLabel(task.due_at)} />
				<DataRow label="Updated" value={dateLabel(task.updated_at)} />
				{#if task.completed_at}
					<DataRow label="Completed" value={dateLabel(task.completed_at)} />
				{/if}
				{#if task.cancelled_at}
					<DataRow label="Cancelled" value={dateLabel(task.cancelled_at)} />
					<DataRow label="Cancel reason" value={task.cancel_reason ?? 'Not recorded'} />
				{/if}
			</dl>
		</Section>
	</div>

	<CommandBar
		commands={data.legalCommands}
		targetId={task.id}
		expectedVersion={task.version}
		form={form as never}
		{forceRequiredByCommand}
	/>
</div>
