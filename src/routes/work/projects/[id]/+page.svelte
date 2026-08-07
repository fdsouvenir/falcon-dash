<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandFeedback,
		CommandForm,
		DataRow,
		EmptyState,
		SourceRefs,
		Timeline,
		WorkGlyph
	} from '$lib/components/work/index.js';
	import { typeLabel, workHref } from '$lib/work3/hrefs.js';
	import { commandLabel } from '$lib/work3/labels.js';
	import type { ActionData, PageData } from './$types.js';

	interface ProjectLink {
		id: string;
		rel_type: string;
		source_id: string;
		target_id: string;
		source_type: string;
		criterion_id: string | null;
		source_revision?: string | null;
		source_refs?: Array<{
			kind: string;
			ref: string;
			label?: string;
			locator?: string;
			captured_at?: number;
			available?: boolean;
			reason?: string;
		}>;
		source_refs_omitted?: number;
		invalidated: boolean;
		invalidated_reason?: string | null;
	}

	interface ProjectCriterion {
		id: string;
		text: string;
		satisfied: boolean;
		waived?: { reason: string; by: string; at: number };
		contributions: ProjectLink[];
		satisfactions: ProjectLink[];
	}

	interface ProjectMilestone {
		id: string;
		title: string;
		summary?: string | null;
		success_condition: string;
		sequence: number;
		status: string;
		schedule_state: string;
		target_at?: number | null;
		source_refs?: ProjectLink['source_refs'];
		source_refs_omitted?: number;
		waived_sources_reason?: string | null;
		proof_historical?: boolean;
		contributions?: ProjectLink[];
		satisfactions?: ProjectLink[];
		historical_satisfactions?: ProjectLink[];
		version: number;
	}

	interface ProjectWork {
		id: string;
		title: string;
		status: string;
		type: 'task' | 'question' | 'decision' | 'change_request';
		milestone_id?: string | null;
		due_at?: number | null;
		waiting_on?: string | null;
		secondary_state?: string | null;
		rollback_started_at?: number | null;
		terminal: boolean;
	}

	interface ProjectDetail {
		id: string;
		title: string;
		summary?: string | null;
		status: string;
		health: string;
		health_reason: string;
		progress: {
			criteria: string;
			milestones: string;
			work_open: number;
			work_blocked: number;
		};
		current_next_item_id?: string | null;
		current_next_valid?: boolean;
		current_next?: {
			id: string;
			title: string;
			type: ProjectWork['type'];
			status: string;
		} | null;
		archived: boolean;
		version: number;
		desired_outcome?: string | null;
		why_it_matters?: string | null;
		scope_included?: string[];
		scope_excluded?: string[];
		completion_criteria?: ProjectCriterion[];
		unscoped_contributions?: ProjectLink[];
		owner?: string | null;
		target_at?: number | null;
		plan_id?: string | null;
		plan_not_required_reason?: string | null;
		area_id?: string | null;
		updated_at?: number | null;
		risk_flags?: Array<{
			key: string;
			label: string;
			severity: 'danger' | 'warning' | 'muted';
		}>;
		milestones?: ProjectMilestone[];
		work?: ProjectWork[];
		history?: Array<{
			id?: string;
			occurred_at?: number;
			summary?: string;
			event_type?: string;
			version_from?: number | null;
			version_to?: number | null;
			actor?: { label?: string; kind?: string };
			authority_act?: boolean;
			source_refs?: unknown[];
		}>;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const project = $derived(data.project as unknown as ProjectDetail);
	const milestones = $derived(
		[...(project.milestones ?? [])].sort((a, b) => a.sequence - b.sequence)
	);
	const work = $derived(project.work ?? []);
	const criteria = $derived(project.completion_criteria ?? []);
	const unscopedContributions = $derived(project.unscoped_contributions ?? []);
	const terminalProject = $derived(['completed', 'cancelled'].includes(project.status));
	const currentNext = $derived(
		project.current_next ?? work.find((item) => item.id === project.current_next_item_id) ?? null
	);
	const looseWork = $derived([...work].filter((item) => !item.milestone_id).sort(compareWork));
	const needsResolution = $derived(
		[...work]
			.filter(
				(item) =>
					!item.terminal &&
					((item.type === 'question' && item.status === 'open') ||
						(item.type === 'decision' && ['pending', 'deferred'].includes(item.status)))
			)
			.sort(compareWork)
	);
	const editableProject = $derived(!project.archived && !terminalProject);
	const attentionFlags = $derived(
		(project.risk_flags ?? []).filter(
			(flag) =>
				flag.severity !== 'muted' &&
				!['blocked_work', 'blocked_next', 'no_next_item'].includes(flag.key)
		)
	);
	const projectInitialValues = $derived({
		title: project.title,
		summary: project.summary ?? '',
		desired_outcome: project.desired_outcome ?? '',
		why_it_matters: project.why_it_matters ?? '',
		scope_included: JSON.stringify(project.scope_included ?? [], null, 2),
		scope_excluded: JSON.stringify(project.scope_excluded ?? [], null, 2),
		owner: project.owner ?? '',
		target_at: project.target_at ? String(project.target_at) : ''
	});

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

	const completionReady = $derived.by(() => {
		const [complete = 0, total = 0] = project.progress.criteria.split('/').map(Number);
		return complete === total && !project.current_next_item_id;
	});
	const primaryCommand = $derived.by(() => {
		if (project.status === 'active' && completionReady) return 'complete_project';
		return lifecycleCommands.find(
			(command) => !['cancel_project', 'archive_project'].includes(command)
		);
	});
	const secondaryCommands = $derived(
		project.status === 'active' && primaryCommand !== 'complete_project' ? ['complete_project'] : []
	);
	const overflowCommands = $derived(
		lifecycleCommands.filter(
			(command) => command !== primaryCommand && !secondaryCommands.includes(command)
		)
	);

	const progressPercent = $derived.by(() => {
		const [criteriaDone = 0, criteriaTotal = 0] = project.progress.criteria.split('/').map(Number);
		if (criteriaTotal > 0) return Math.round((criteriaDone / criteriaTotal) * 100);
		const [milestonesDone = 0, milestonesTotal = 0] = project.progress.milestones
			.split('/')
			.map(Number);
		if (milestonesTotal > 0) return Math.round((milestonesDone / milestonesTotal) * 100);
		return terminalProject ? 100 : 0;
	});

	function milestoneWork(milestoneId: string): ProjectWork[] {
		return [...work].filter((item) => item.milestone_id === milestoneId).sort(compareWork);
	}

	function milestoneProgress(milestoneId: string): {
		complete: number;
		total: number;
		percent: number;
	} {
		const items = milestoneWork(milestoneId);
		const complete = items.filter((item) => item.terminal).length;
		return {
			complete,
			total: items.length,
			percent: items.length ? Math.round((complete / items.length) * 100) : 0
		};
	}

	function compareWork(left: ProjectWork, right: ProjectWork): number {
		if (left.due_at && right.due_at) return left.due_at - right.due_at;
		if (left.due_at) return -1;
		if (right.due_at) return 1;
		return left.id.localeCompare(right.id);
	}

	function milestoneCommands(milestone: ProjectMilestone): string[] {
		if (milestone.status === 'planned') return ['achieve_milestone', 'cancel_milestone'];
		if (['achieved', 'cancelled'].includes(milestone.status)) return ['reopen_milestone'];
		return [];
	}

	function projectCommandLabel(command: string): string {
		if (command === 'activate_project' && project.status === 'paused') return 'Resume project';
		return commandLabel(command);
	}

	function formatDate(value?: number | null): string {
		return value
			? new Date(value).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			: 'Not set';
	}

	function formatDateTime(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not set';
	}

	function humanize(value: string): string {
		return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
	}

	function lifecycleTone(value: string): string {
		if (value === 'active') return 'text-status-active';
		if (value === 'paused') return 'text-status-warning';
		if (value === 'completed') return 'text-status-info';
		if (value === 'cancelled') return 'text-status-danger';
		return 'text-on-surface-variant';
	}

	function scheduleTone(value: string): string {
		if (value === 'overdue') return 'text-status-danger';
		if (value === 'due_soon') return 'text-status-warning';
		if (value === 'achieved') return 'text-status-active';
		return 'text-on-surface-variant';
	}

	function workMeta(item: ProjectWork): string {
		const details: string[] = [];
		if (item.waiting_on) details.push(`Waiting on ${item.waiting_on}`);
		if (item.secondary_state)
			details.push(`Verification ${humanize(item.secondary_state).toLowerCase()}`);
		if (item.rollback_started_at) details.push('Rollback in progress');
		return details.join(' · ');
	}

	function sourceTitle(id: string): string {
		return work.find((item) => item.id === id)?.title ?? id;
	}
</script>

{#snippet projectAction(command: string, label: string, primary: boolean)}
	<details class="group/action relative">
		<summary
			class="falcon-focus touch-target flex cursor-pointer list-none items-center gap-2 rounded-[var(--md-sys-shape-corner-medium)] border px-3 text-[length:var(--text-label)] font-semibold marker:content-none {primary
				? 'border-primary bg-primary text-on-primary'
				: 'border-outline-variant bg-surface-container-high text-on-surface'}"
		>
			{label}
			<span aria-hidden="true">⌄</span>
		</summary>
		<div
			class="absolute right-0 z-40 mt-2 max-h-[calc(100vh-12rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant bg-surface-container p-4 shadow-xl"
		>
			<CommandForm
				{command}
				targetId={project.id}
				expectedVersion={project.version}
				form={form as never}
				initialValues={command === 'update_project' ? projectInitialValues : {}}
				optionalFieldsOpen={command === 'update_project'}
				optionalFieldsLabel={command === 'update_project' ? 'Project fields' : 'More options'}
				submitLabel={label}
				compact
			/>
		</div>
	</details>
{/snippet}

{#snippet workRow(item: ProjectWork)}
	<article
		class="group/row relative grid min-w-0 gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-container-high/70 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
		data-project-work-row
	>
		<div class="flex items-start gap-3 md:contents">
			<WorkGlyph type={item.type} size={28} />
			<div class="min-w-0">
				<a
					href={workHref(item.type, item.id)}
					class="falcon-focus block rounded font-medium text-on-surface hover:text-primary"
				>
					{item.title}
				</a>
				<div
					class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[length:var(--text-label)] text-on-surface-variant"
				>
					<span>{typeLabel(item.type)}</span>
					<span aria-hidden="true">·</span>
					<span class={item.terminal ? 'text-on-surface-variant' : 'text-on-surface'}>
						{humanize(item.status)}
					</span>
					{#if item.due_at}
						<span aria-hidden="true">·</span>
						<span
							class={item.due_at < data.now && !item.terminal
								? 'text-status-danger'
								: 'text-on-surface-variant'}
						>
							{item.due_at < data.now && !item.terminal ? 'Overdue · ' : 'Due '}{formatDate(
								item.due_at
							)}
						</span>
					{/if}
					{#if workMeta(item)}
						<span aria-hidden="true">·</span>
						<span class="text-on-surface-variant">{workMeta(item)}</span>
					{/if}
					<span aria-hidden="true">·</span>
					<span class="font-mono">{item.id}</span>
				</div>
			</div>
		</div>
		{#if !project.archived && !terminalProject && !item.terminal}
			<details class="justify-self-start md:justify-self-end">
				<summary
					class="falcon-focus touch-target cursor-pointer list-none rounded px-2 text-[length:var(--text-label)] font-semibold text-primary marker:content-none"
				>
					{item.id === project.current_next_item_id ? 'Clear next' : 'Make next'}
				</summary>
				<div
					class="mt-2 w-44 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container p-3 md:absolute md:right-4 md:z-20"
				>
					<CommandForm
						command="set_current_next_item"
						targetId={project.id}
						expectedVersion={project.version}
						form={form as never}
						presetValues={{
							item_id: item.id === project.current_next_item_id ? '' : item.id
						}}
						confirmationSubject={item.title}
						submitLabel={item.id === project.current_next_item_id
							? 'Clear next'
							: 'Make current next'}
						compact
					/>
				</div>
			</details>
		{/if}
	</article>
{/snippet}

{#snippet resolutionRow(item: ProjectWork)}
	<a
		href={workHref(item.type, item.id)}
		class="falcon-focus group flex min-w-0 items-start gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-3 py-3 transition-colors duration-150 hover:bg-status-warning-bg"
	>
		<WorkGlyph type={item.type} size={28} />
		<span class="min-w-0 flex-1">
			<span class="block font-medium text-on-surface group-hover:text-primary">{item.title}</span>
			<span class="mt-1 block text-[length:var(--text-label)] text-on-surface-variant">
				{item.type === 'decision'
					? 'A decision is waiting for you'
					: 'A question needs an answer'}{item.due_at
					? ` · ${item.due_at < data.now ? 'Overdue' : 'Due'} ${formatDate(item.due_at)}`
					: ''}
			</span>
		</span>
		<span class="pt-1 text-primary" aria-hidden="true">→</span>
	</a>
{/snippet}

<svelte:head><title>{project.title} — Project</title></svelte:head>

<div class="mx-auto max-w-[90rem] space-y-6">
	<a
		href={resolve('/work/projects')}
		class="falcon-focus touch-target inline-flex items-center gap-2 rounded text-[length:var(--text-label)] font-semibold text-on-surface-variant hover:text-primary"
	>
		<span aria-hidden="true">←</span> Projects
	</a>

	<header class="border-b border-outline-variant/70 pb-6">
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
						{project.id}
					</span>
					<span
						class="text-[length:var(--text-label)] font-semibold {lifecycleTone(project.status)}"
					>
						{humanize(project.status)}
					</span>
				</div>
				<h1
					class="mt-2 max-w-5xl break-words text-3xl font-semibold tracking-tight text-on-surface"
				>
					{project.title}
				</h1>
				{#if project.desired_outcome ?? project.summary}
					<p
						class="mt-3 max-w-4xl text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
						title={project.desired_outcome ?? project.summary ?? undefined}
					>
						{project.desired_outcome ?? project.summary}
					</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-start gap-2 lg:justify-end" aria-label="Project actions">
				{#if primaryCommand}
					{@render projectAction(primaryCommand, projectCommandLabel(primaryCommand), true)}
				{/if}
				{#if editableProject}
					{@render projectAction('update_project', 'Edit project', false)}
				{/if}
				{#each secondaryCommands as command (command)}
					{@render projectAction(command, commandLabel(command), false)}
				{/each}
				{#if overflowCommands.length}
					<details class="group/action relative">
						<summary
							class="falcon-focus touch-target flex cursor-pointer list-none items-center rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container-high px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none"
						>
							More
						</summary>
						<div
							class="absolute right-0 z-40 mt-2 w-[min(34rem,calc(100vw-2rem))] space-y-4 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant bg-surface-container p-4 shadow-xl"
						>
							{#each overflowCommands as command (command)}
								<div class="border-b border-outline-variant/60 pb-4 last:border-0 last:pb-0">
									<CommandForm
										{command}
										targetId={project.id}
										expectedVersion={project.version}
										form={form as never}
										compact
									/>
								</div>
							{/each}
						</div>
					</details>
				{/if}
			</div>
		</div>

		<div class="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div
				class="h-2 overflow-hidden rounded-full bg-surface-container-high"
				role="progressbar"
				aria-label="Project progress"
				aria-valuenow={progressPercent}
				aria-valuemin="0"
				aria-valuemax="100"
			>
				<div
					class="h-full rounded-full bg-status-active transition-[width] duration-300 motion-reduce:transition-none"
					style={`width: ${progressPercent}%`}
				></div>
			</div>
			<span class="text-[length:var(--text-label)] font-medium text-on-surface">
				{progressPercent}% complete
			</span>
		</div>
		<div
			class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--text-label)] text-on-surface-variant"
		>
			<span>{project.progress.criteria} finish-line items</span>
			<span>{project.progress.milestones} milestones</span>
			<span>{project.progress.work_open} open</span>
			{#if project.progress.work_blocked > 0}
				<span class="text-status-danger">{project.progress.work_blocked} blocked</span>
			{/if}
			{#if project.target_at}<span>Target {formatDate(project.target_at)}</span>{/if}
		</div>
		{#if attentionFlags.length}
			<ul class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--text-label)]">
				{#each attentionFlags as flag (flag.key)}
					<li class={flag.severity === 'danger' ? 'text-status-danger' : 'text-status-warning'}>
						{flag.label}
					</li>
				{/each}
			</ul>
		{/if}
	</header>

	<CommandFeedback form={form as never} />

	<section
		class="overflow-hidden rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border {project.current_next_valid &&
		currentNext
			? 'border-primary/60 bg-primary/[0.06]'
			: project.status === 'active'
				? 'border-status-warning/50 bg-status-warning-bg'
				: 'border-outline-variant/70 bg-surface-container-low'}"
		aria-labelledby="project-next-heading"
	>
		<div class="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
			<div class="min-w-0">
				<h2 id="project-next-heading" class="text-lg font-semibold text-on-surface">Next up</h2>
				{#if project.current_next_valid && currentNext}
					<a
						href={workHref(currentNext.type, currentNext.id)}
						class="falcon-focus mt-2 block max-w-4xl rounded text-xl font-semibold text-on-surface hover:text-primary"
					>
						{currentNext.title}
					</a>
					<div
						class="mt-2 flex flex-wrap gap-x-2 text-[length:var(--text-label)] text-on-surface-variant"
					>
						<span>{typeLabel(currentNext.type)}</span>
						<span aria-hidden="true">·</span>
						<span>{humanize(currentNext.status)}</span>
						{#if work.find((item) => item.id === currentNext?.id)?.due_at}
							<span aria-hidden="true">·</span>
							<span>Due {formatDate(work.find((item) => item.id === currentNext?.id)?.due_at)}</span
							>
						{/if}
					</div>
				{:else}
					<p class="mt-2 max-w-3xl text-[length:var(--text-body)] text-on-surface-variant">
						{project.status === 'active'
							? 'No next move has been chosen. Pick one from the project work below so the agent knows what to move forward.'
							: project.status === 'paused'
								? 'This project is paused. Choose a next move after it resumes.'
								: project.status === 'completed'
									? 'This project is finished.'
									: 'A next move can be chosen once this project is active.'}
					</p>
				{/if}
			</div>
			{#if project.current_next_valid && currentNext && editableProject}
				<details class="relative justify-self-start md:justify-self-end">
					<summary
						class="falcon-focus touch-target cursor-pointer list-none rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none"
					>
						Change next move
					</summary>
					<div
						class="mt-2 w-52 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container p-3 md:absolute md:right-0 md:z-20"
					>
						<CommandForm
							command="set_current_next_item"
							targetId={project.id}
							expectedVersion={project.version}
							form={form as never}
							presetValues={{ item_id: '' }}
							confirmationSubject={currentNext.title}
							submitLabel="Clear next move"
							compact
						/>
					</div>
				</details>
			{/if}
		</div>
	</section>

	<div class="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
		<main class="min-w-0 space-y-6">
			{#if needsResolution.length}
				<section
					class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-status-warning/45 bg-status-warning-bg p-2"
					aria-labelledby="project-resolution-heading"
				>
					<div class="flex items-start justify-between gap-4 px-3 pb-2 pt-2">
						<div>
							<h2 id="project-resolution-heading" class="text-lg font-semibold text-on-surface">
								Needs your input
							</h2>
							<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
								Resolve {needsResolution.length === 1 ? 'this item' : 'these items'} to keep the project
								moving.
							</p>
						</div>
						<span class="text-2xl text-primary" aria-hidden="true">✦</span>
					</div>
					<div class="divide-y divide-status-warning/25">
						{#each needsResolution as item (item.id)}
							{@render resolutionRow(item)}
						{/each}
					</div>
				</section>
			{/if}

			<section class="min-w-0" aria-labelledby="project-work-heading">
				<div
					class="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/70 pb-3"
				>
					<div>
						<h2 id="project-work-heading" class="text-xl font-semibold text-on-surface">Work</h2>
						<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
							Tasks, questions, decisions, and changes the agent is managing.
						</p>
					</div>
					{#if editableProject}
						<details class="relative">
							<summary
								class="falcon-focus touch-target cursor-pointer list-none rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none hover:border-primary/60"
							>
								+ Add milestone
							</summary>
							<div
								class="absolute right-0 z-30 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant bg-surface-container p-4 shadow-xl"
							>
								<CommandForm
									command="create_milestone"
									form={form as never}
									presetValues={{ project_id: project.id }}
									compact
								/>
							</div>
						</details>
					{/if}
				</div>

				<div class="mt-4">
					<div class="mb-3 flex items-baseline justify-between gap-3">
						<h3 class="font-semibold text-on-surface">Milestones</h3>
						{#if milestones.length}
							<p class="text-[length:var(--text-label)] text-on-surface-variant">
								{project.progress.milestones} reached
							</p>
						{/if}
					</div>
					{#if milestones.length}
						<div class="grid gap-4 2xl:grid-cols-2">
							{#each milestones as milestone, index (milestone.id)}
								{@const milestoneItems = milestoneWork(milestone.id)}
								{@const milestoneDone = milestoneProgress(milestone.id)}
								<article
									class="overflow-hidden rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
								>
									<div class="p-4">
										<div class="flex items-start gap-3">
											<span
												class="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-active-bg font-mono text-[length:var(--text-label)] font-semibold text-status-active"
												aria-label={`Milestone ${index + 1}`}
											>
												{index + 1}
											</span>
											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
													<h4 class="font-semibold text-on-surface">{milestone.title}</h4>
													<span
														class="text-[length:var(--text-label)] font-semibold {scheduleTone(
															milestone.schedule_state
														)}"
													>
														{humanize(milestone.status)}
													</span>
												</div>
												<p
													class="mt-1 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
												>
													Finish when {milestone.success_condition}
												</p>
												<div class="mt-3 flex items-center gap-3">
													<div
														class="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-surface-container-high"
													>
														<div
															class="h-full rounded-full bg-status-active"
															style={`width: ${milestoneDone.percent}%`}
														></div>
													</div>
													<span class="text-[length:var(--text-label)] text-on-surface-variant">
														{milestoneDone.complete} of {milestoneDone.total} done
													</span>
												</div>
												{#if milestone.target_at}
													<p class="mt-2 text-[length:var(--text-label)] text-on-surface-variant">
														Target {formatDate(milestone.target_at)}
													</p>
												{/if}
											</div>
										</div>
									</div>

									{#if milestoneItems.length}
										<div
											class="divide-y divide-outline-variant/60 border-t border-outline-variant/60"
										>
											{#each milestoneItems as item (item.id)}
												{@render workRow(item)}
											{/each}
										</div>
									{:else}
										<p
											class="border-t border-outline-variant/60 px-4 py-3 text-[length:var(--text-label)] text-on-surface-variant"
										>
											No work is connected to this milestone yet.
										</p>
									{/if}

									{#if milestone.status === 'achieved' && (milestone.source_refs?.length || (milestone.source_refs_omitted ?? 0) > 0)}
										<div class="border-t border-outline-variant/60 px-4 py-3">
											<SourceRefs
												sources={milestone.source_refs}
												title="How we know"
												omittedCount={milestone.source_refs_omitted ?? 0}
											/>
										</div>
									{/if}
									{#if !project.archived && milestoneCommands(milestone).length}
										<details class="border-t border-outline-variant/60 px-4 py-2">
											<summary
												class="falcon-focus touch-target cursor-pointer text-[length:var(--text-label)] font-semibold text-primary"
											>
												Milestone actions
											</summary>
											<div class="space-y-3 pb-2 pt-2">
												{#each milestoneCommands(milestone) as command (command)}
													<CommandForm
														{command}
														targetId={milestone.id}
														expectedVersion={milestone.version}
														form={form as never}
														requireExactlyOneOf={command === 'achieve_milestone'
															? ['source_refs', 'waive_sources_reason']
															: []}
														compact
													/>
												{/each}
											</div>
										</details>
									{/if}
								</article>
							{/each}
						</div>
					{:else}
						<p class="text-[length:var(--text-label)] text-on-surface-variant">
							No milestones yet.
						</p>
					{/if}
				</div>

				{#if looseWork.length}
					<div
						class="mt-4 divide-y divide-outline-variant/60 overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container-low"
					>
						{#each looseWork as item (item.id)}
							{@render workRow(item)}
						{/each}
					</div>
				{/if}

				{#if !milestones.length && !looseWork.length}
					<div
						class="mt-4 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container-low p-4"
					>
						<EmptyState
							title="No work yet"
							description="Tasks, questions, decisions, and changes will appear here when they are connected to this project."
						/>
					</div>
				{/if}
			</section>

			<section
				class="border-t border-outline-variant/70 pt-4"
				aria-labelledby="project-activity-heading"
			>
				<div class="mb-3 flex items-baseline justify-between gap-3">
					<h2 id="project-activity-heading" class="text-xl font-semibold text-on-surface">
						Activity
					</h2>
					<span class="text-[length:var(--text-label)] text-on-surface-variant">
						{project.history?.length ?? 0} update{project.history?.length === 1 ? '' : 's'}
					</span>
				</div>
				{#if project.history?.length}
					<div
						class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container-low p-4"
					>
						<Timeline events={project.history.slice(0, 6)} />
						<details class="mt-3 border-t border-outline-variant/60 pt-2">
							<summary class="falcon-focus touch-target cursor-pointer font-semibold text-primary">
								History ({project.history.length})
							</summary>
							<div class="pt-3">
								{#if project.history.length > 6}
									<Timeline events={project.history.slice(6)} />
								{:else}
									<p class="text-[length:var(--text-label)] text-on-surface-variant">
										All activity is shown above.
									</p>
								{/if}
							</div>
						</details>
					</div>
				{:else}
					<p class="text-on-surface-variant">No project activity yet.</p>
				{/if}
			</section>
		</main>

		<aside class="min-w-0 space-y-4 xl:sticky xl:top-4">
			<section
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
			>
				<div class="border-b border-outline-variant/70 px-4 py-4">
					<h2 class="text-lg font-semibold text-on-surface">Finish line</h2>
					<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
						What must be true before this project is done.
					</p>
				</div>
				{#if criteria.length}
					<ul class="divide-y divide-outline-variant/60">
						{#each criteria as criterion (criterion.id)}
							<li class="px-4 py-3">
								<div class="flex gap-3">
									<span
										class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-[length:var(--text-label)] {criterion.satisfied
											? 'border-status-active text-status-active'
											: criterion.waived
												? 'border-status-warning text-status-warning'
												: 'border-outline-variant text-transparent'}"
										aria-hidden="true"
									>
										✓
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-[length:var(--text-body)] text-on-surface">{criterion.text}</p>
										<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
											{criterion.satisfied
												? 'Complete'
												: criterion.waived
													? 'Waived'
													: 'Still open'}
										</p>
									</div>
								</div>
								{#if criterion.waived}
									<p class="mt-2 text-[length:var(--text-label)] text-status-warning">
										Waived by {criterion.waived.by}: {criterion.waived.reason}
									</p>
								{/if}
								{#if editableProject && !criterion.satisfied && !criterion.waived}
									<details class="mt-2">
										<summary
											class="falcon-focus touch-target cursor-pointer text-[length:var(--text-label)] font-semibold text-status-warning"
										>
											Waive this item
										</summary>
										<div class="mt-2">
											<CommandForm
												command="waive_completion_criterion"
												targetId={project.id}
												expectedVersion={project.version}
												form={form as never}
												presetValues={{ criterion_id: criterion.id }}
												confirmationSubject={criterion.text}
												compact
											/>
										</div>
									</details>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="px-4 py-4 text-on-surface-variant">No finish-line items have been defined.</p>
				{/if}
			</section>

			<section
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low p-4"
			>
				<h2 class="text-lg font-semibold text-on-surface">About this project</h2>
				{#if project.why_it_matters}
					<p class="mt-3 text-[length:var(--text-label)] font-semibold text-on-surface-variant">
						Why it matters
					</p>
					<p class="mt-1 text-[length:var(--text-body)] leading-relaxed text-on-surface">
						{project.why_it_matters}
					</p>
				{/if}
				<dl class="mt-3 border-t border-outline-variant/60 pt-2">
					<DataRow label="Owner" value={project.owner ?? 'Not assigned'} />
					<DataRow label="Target" value={formatDate(project.target_at)} />
					<DataRow label="Updated" value={formatDateTime(project.updated_at)} />
				</dl>
			</section>

			<details
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
			>
				<summary
					class="falcon-focus touch-target cursor-pointer px-4 py-3 font-semibold text-on-surface"
				>
					Scope and details
				</summary>
				<div class="border-t border-outline-variant/70 px-4 pb-4 pt-3">
					<div>
						<p class="text-[length:var(--text-label)] font-semibold text-on-surface-variant">
							In scope
						</p>
						{#if project.scope_included?.length}
							<ul class="mt-2 space-y-1 text-[length:var(--text-body)] text-on-surface">
								{#each project.scope_included as item (item)}
									<li class="flex gap-2"><span class="text-status-active">✓</span> {item}</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-1 text-on-surface-variant">Not defined</p>
						{/if}
						<p class="mt-4 text-[length:var(--text-label)] font-semibold text-on-surface-variant">
							Out of scope
						</p>
						{#if project.scope_excluded?.length}
							<ul class="mt-2 space-y-1 text-[length:var(--text-body)] text-on-surface">
								{#each project.scope_excluded as item (item)}
									<li class="flex gap-2"><span class="text-on-surface-variant">—</span> {item}</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-1 text-on-surface-variant">Nothing recorded</p>
						{/if}
					</div>
					<dl class="mt-4 border-t border-outline-variant/60 pt-2">
						<DataRow label="Area" value={project.area_id ?? 'Not assigned'} mono />
						<DataRow label="Plan" value={project.plan_id ?? 'No plan attached'} mono />
						<DataRow label="Version" value={String(project.version)} mono />
					</dl>
				</div>
			</details>

			<details
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
			>
				<summary
					class="falcon-focus touch-target cursor-pointer px-4 py-3 font-semibold text-on-surface"
				>
					How we know
				</summary>
				<div class="space-y-3 border-t border-outline-variant/70 p-4">
					{#if unscopedContributions.length}
						{#each unscopedContributions as link (link.id)}
							<div>
								<a
									href={workHref(link.source_type, link.source_id)}
									class="falcon-focus font-medium text-on-surface hover:text-primary"
								>
									{sourceTitle(link.source_id)}
								</a>
								{#if link.source_refs?.length || (link.source_refs_omitted ?? 0) > 0}
									<div class="mt-2">
										<SourceRefs
											sources={link.source_refs ?? []}
											omittedCount={link.source_refs_omitted ?? 0}
										/>
									</div>
								{/if}
							</div>
						{/each}
					{/if}
					{#each criteria.filter((criterion) => criterion.satisfactions.length > 0) as criterion (criterion.id)}
						<div class="border-t border-outline-variant/60 pt-3 first:border-0 first:pt-0">
							<p class="text-[length:var(--text-label)] text-on-surface-variant">
								{criterion.text}
							</p>
							{#each criterion.satisfactions as link (link.id)}
								<div class="mt-2">
									<SourceRefs
										sources={link.source_refs ?? []}
										title={sourceTitle(link.source_id)}
										omittedCount={link.source_refs_omitted ?? 0}
									/>
								</div>
							{/each}
						</div>
					{/each}
					{#if !unscopedContributions.length && !criteria.some((criterion) => criterion.satisfactions.length > 0)}
						<p class="text-on-surface-variant">No sources have been connected yet.</p>
					{/if}
				</div>
			</details>
		</aside>
	</div>
</div>
