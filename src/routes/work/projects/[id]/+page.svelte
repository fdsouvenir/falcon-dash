<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandFeedback,
		CommandForm,
		EmptyState,
		SourceRefs,
		Timeline,
		WorkGlyph
	} from '$lib/components/work/index.js';
	import { typeLabel, workHref } from '$lib/work3/hrefs.js';
	import { commandLabel } from '$lib/work3/labels.js';
	import { ArrowLeft, Check, ChevronDown, Ellipsis, Flag, UserRound } from '@lucide/svelte';
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

	interface ProjectHistoryEvent {
		id?: string;
		occurred_at?: number;
		summary?: string;
		event_type?: string;
		version_from?: number | null;
		version_to?: number | null;
		actor?: { label?: string; kind?: string };
		authority_act?: boolean;
		source_refs?: unknown[];
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
		history?: ProjectHistoryEvent[];
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const project = $derived(data.project as unknown as ProjectDetail);
	const work = $derived(project.work ?? []);
	const milestones = $derived(
		[...(project.milestones ?? [])].sort((left, right) => left.sequence - right.sequence)
	);
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

	function milestoneTitle(id: string): string {
		return milestones.find((milestone) => milestone.id === id)?.title ?? 'a milestone';
	}

	function activitySummary(event: ProjectHistoryEvent): string {
		const summary = event.summary ?? '';
		const contribution = summary.match(/^([^ ]+) contributes_to ([^ ]+)$/);
		if (contribution) {
			return `added “${sourceTitle(contribution[1])}” to ${milestoneTitle(contribution[2])}`;
		}
		const assignment = summary.match(/^Assigned ([^ ]+) to ([^ ]+)$/);
		if (assignment) return `connected “${sourceTitle(assignment[1])}” to this project`;
		if (summary) return summary.replaceAll('_', ' ');
		return humanize(event.event_type ?? 'updated this project').toLowerCase();
	}

	function actorInitials(label?: string): string {
		return (label ?? 'Agent')
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join('');
	}

	function formatActivityTime(value?: number): string {
		if (!value) return 'Time unavailable';
		return new Date(value).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

{#snippet projectAction(command: string, label: string)}
	<details
		class="group/command rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/60"
	>
		<summary
			class="falcon-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none hover:bg-surface-container-high"
		>
			{label}
			<ChevronDown
				size={16}
				class="transition-transform duration-150 group-open/command:rotate-180 motion-reduce:transition-none"
			/>
		</summary>
		<div class="border-t border-outline-variant/60 p-3">
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
		class="group/row relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-container-high/65"
		data-project-work-row
	>
		<WorkGlyph type={item.type} size={30} />
		<div class="min-w-0">
			<a
				href={workHref(item.type, item.id)}
				class="falcon-focus block rounded font-medium leading-snug break-words text-on-surface [overflow-wrap:anywhere] hover:text-primary"
			>
				{item.title}
			</a>
			<div
				class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[length:var(--text-label)] text-on-surface-variant"
			>
				<span>{typeLabel(item.type)}</span>
				{#if item.due_at}
					<span aria-hidden="true">·</span>
					<span class={item.due_at < data.now && !item.terminal ? 'text-status-danger' : ''}>
						{item.due_at < data.now && !item.terminal ? 'Overdue' : 'Due'}
						{formatDate(item.due_at)}
					</span>
				{/if}
				{#if workMeta(item)}
					<span aria-hidden="true">·</span>
					<span>{workMeta(item)}</span>
				{/if}
			</div>
		</div>
		<div class="flex items-center justify-end gap-2">
			<span
				class="whitespace-nowrap text-[length:var(--text-label)] font-medium {item.id ===
				project.current_next_item_id
					? 'text-primary'
					: item.terminal
						? 'text-status-active'
						: 'text-on-surface-variant'}"
			>
				{item.id === project.current_next_item_id ? 'Up next' : humanize(item.status)}
			</span>
			{#if !project.archived && !terminalProject && !item.terminal}
				<details class="relative">
					<summary
						class="falcon-focus flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-on-surface-variant marker:content-none hover:bg-surface-container-highest hover:text-on-surface"
						aria-label={`Actions for ${item.title}`}
					>
						<Ellipsis size={18} />
					</summary>
					<div
						class="absolute right-0 z-30 mt-2 w-52 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container p-3 shadow-xl"
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
		</div>
	</article>
{/snippet}

{#snippet resolutionRow(item: ProjectWork)}
	<a
		href={workHref(item.type, item.id)}
		class="falcon-focus group flex min-w-0 items-center gap-3 rounded-[var(--md-sys-shape-corner-large)] border border-status-warning/45 bg-status-warning-bg px-4 py-4 transition-colors duration-150 hover:border-status-warning/80"
	>
		<WorkGlyph type={item.type} size={32} />
		<span class="min-w-0 flex-1">
			<span class="block font-semibold text-on-surface group-hover:text-primary">{item.title}</span>
			<span class="mt-1 block text-[length:var(--text-label)] text-on-surface-variant">
				{item.type === 'decision'
					? 'A decision is waiting for you'
					: 'A question needs an answer'}{item.due_at
					? ` · ${item.due_at < data.now ? 'Overdue' : 'Due'} ${formatDate(item.due_at)}`
					: ''}
			</span>
		</span>
		<span class="text-primary" aria-hidden="true">→</span>
	</a>
{/snippet}

{#snippet activityRow(event: ProjectHistoryEvent)}
	<li class="grid gap-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
		<span
			class="flex size-9 items-center justify-center rounded-full bg-status-info-bg text-[length:var(--text-label)] font-semibold text-status-info"
			aria-hidden="true"
		>
			{actorInitials(event.actor?.label)}
		</span>
		<p
			class="min-w-0 text-[length:var(--text-body)] leading-relaxed break-words text-on-surface [overflow-wrap:anywhere]"
		>
			<strong class="font-semibold">{event.actor?.label ?? 'Agent'}</strong>
			{activitySummary(event)}
			{#if event.authority_act}
				<span class="text-status-purple"> with your approval</span>
			{/if}
		</p>
		<time
			class="pl-12 text-[length:var(--text-label)] text-on-surface-variant sm:pl-0"
			datetime={event.occurred_at ? new Date(event.occurred_at).toISOString() : undefined}
		>
			{formatActivityTime(event.occurred_at)}
		</time>
	</li>
{/snippet}

<svelte:head><title>{project.title} — Project</title></svelte:head>

<div class="mx-auto max-w-[86rem] space-y-8 pb-16">
	<header>
		<a
			href={resolve('/work/projects')}
			class="falcon-focus inline-flex min-h-10 items-center gap-2 rounded text-[length:var(--text-label)] font-medium text-on-surface-variant hover:text-primary"
		>
			<ArrowLeft size={16} />
			Projects
		</a>

		<div class="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
			<div class="min-w-0">
				<h1
					class="max-w-5xl text-2xl font-semibold tracking-tight break-words text-on-surface [overflow-wrap:anywhere] sm:text-4xl"
				>
					{project.title}
				</h1>
				{#if project.desired_outcome ?? project.summary}
					<p
						class="mt-3 max-w-4xl text-base leading-relaxed break-words text-on-surface-variant [overflow-wrap:anywhere] sm:text-lg"
					>
						{project.desired_outcome ?? project.summary}
					</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-x-5 gap-y-3 lg:justify-end">
				<p class="flex items-center gap-2 text-[length:var(--text-body)] text-on-surface-variant">
					<span>Status</span>
					<span class="flex items-center gap-2 font-semibold {lifecycleTone(project.status)}">
						<span class="size-2 rounded-full bg-current" aria-hidden="true"></span>
						{humanize(project.status)}
					</span>
				</p>

				<details class="group/actions relative">
					<summary
						class="falcon-focus flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container-low px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none hover:border-primary/60"
					>
						Project actions
						<ChevronDown
							size={16}
							class="transition-transform duration-150 group-open/actions:rotate-180 motion-reduce:transition-none"
						/>
					</summary>
					<div
						class="absolute right-0 z-40 mt-2 max-h-[calc(100vh-10rem)] w-[min(34rem,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant bg-surface-container p-4 shadow-xl"
					>
						<div class="mb-1">
							<h2 class="font-semibold text-on-surface">Project actions</h2>
							<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
								Update the project or change its status.
							</p>
						</div>
						{#if primaryCommand}
							{@render projectAction(primaryCommand, projectCommandLabel(primaryCommand))}
						{/if}
						{#if editableProject}
							{@render projectAction('update_project', 'Edit project')}
						{/if}
						{#each secondaryCommands as command (command)}
							{@render projectAction(command, commandLabel(command))}
						{/each}
						{#each overflowCommands as command (command)}
							{@render projectAction(command, commandLabel(command))}
						{/each}
					</div>
				</details>
			</div>
		</div>

		<div
			class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[length:var(--text-label)] text-on-surface-variant"
		>
			<span class="inline-flex items-center gap-2">
				<UserRound size={16} />
				{project.owner ?? 'No owner yet'}
			</span>
			<span>{project.target_at ? `Target ${formatDate(project.target_at)}` : 'No target date'}</span
			>
			<span>{project.progress.work_open} open</span>
			{#if project.progress.work_blocked > 0}
				<span class="text-status-danger">{project.progress.work_blocked} blocked</span>
			{/if}
			<span class="font-mono text-xs">{project.id}</span>
		</div>
		{#if attentionFlags.length}
			<ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--text-label)]">
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
		class="overflow-hidden rounded-[calc(var(--md-sys-shape-corner-large)+0.35rem)] border-2 {project.current_next_valid &&
		currentNext
			? 'border-status-info/75 bg-status-info-bg'
			: project.status === 'active'
				? 'border-status-warning/55 bg-status-warning-bg'
				: 'border-outline-variant bg-surface-container-low'}"
		aria-labelledby="project-next-heading"
	>
		<div class="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
			<div class="min-w-0">
				<h2 id="project-next-heading" class="text-xl font-semibold text-on-surface">Next up</h2>
				{#if project.current_next_valid && currentNext}
					<a
						href={workHref(currentNext.type, currentNext.id)}
						class="falcon-focus mt-2 block max-w-4xl rounded text-2xl font-semibold tracking-tight text-on-surface hover:text-primary"
					>
						{currentNext.title}
					</a>
					<p class="mt-2 text-[length:var(--text-body)] text-on-surface-variant">
						{typeLabel(currentNext.type)} · {humanize(currentNext.status)}
						{#if work.find((item) => item.id === currentNext?.id)?.due_at}
							· Due {formatDate(work.find((item) => item.id === currentNext?.id)?.due_at)}
						{/if}
					</p>
				{:else}
					<p
						class="mt-2 max-w-3xl text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
					>
						{project.status === 'active'
							? 'Nothing is set as the next move. Choose one from the work below to make the project’s direction clear.'
							: project.status === 'paused'
								? 'This project is paused. Choose the next move when it resumes.'
								: project.status === 'completed'
									? 'This project is finished.'
									: 'Choose a next move after this project starts.'}
					</p>
				{/if}
			</div>
			{#if project.current_next_valid && currentNext && editableProject}
				<details class="relative justify-self-start md:justify-self-end">
					<summary
						class="falcon-focus flex min-h-11 cursor-pointer list-none items-center rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none"
					>
						Change next move
					</summary>
					<div
						class="mt-2 w-56 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container p-3 md:absolute md:right-0 md:z-20"
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
		<div class="flex items-center gap-4 border-t border-current/10 px-5 py-3 sm:px-6">
			<div
				class="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-container-high"
				role="progressbar"
				aria-label="Project progress"
				aria-valuenow={progressPercent}
				aria-valuemin="0"
				aria-valuemax="100"
			>
				<div
					class="h-full rounded-full bg-status-info transition-[width] duration-300 motion-reduce:transition-none"
					style={`width: ${progressPercent}%`}
				></div>
			</div>
			<span class="whitespace-nowrap text-[length:var(--text-label)] font-medium text-on-surface">
				{progressPercent}% complete
			</span>
		</div>
	</section>

	<section aria-labelledby="project-work-heading">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h2 id="project-work-heading" class="text-2xl font-semibold tracking-tight text-on-surface">
					Work
				</h2>
				<p class="mt-1 text-[length:var(--text-body)] text-on-surface-variant">
					What the agent is managing, ordered by what is due next.
				</p>
			</div>
			{#if editableProject}
				<details class="relative">
					<summary
						class="falcon-focus flex min-h-11 cursor-pointer list-none items-center rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container-low px-3 text-[length:var(--text-label)] font-semibold text-on-surface marker:content-none hover:border-primary/60"
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

		<div class="mt-6 flex items-baseline justify-between gap-3">
			<h3 id="project-milestones-heading" class="text-xl font-semibold text-on-surface">
				Milestones
			</h3>
			{#if milestones.length}
				<p class="text-[length:var(--text-label)] text-on-surface-variant">
					{project.progress.milestones} complete
				</p>
			{/if}
		</div>

		{#if milestones.length}
			<div class="mt-3 grid items-start gap-4 lg:grid-cols-2">
				{#each milestones as milestone, index (milestone.id)}
					{@const milestoneItems = milestoneWork(milestone.id)}
					{@const milestoneDone = milestoneProgress(milestone.id)}
					<article
						class="overflow-visible rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/75 bg-surface-container-low {milestones.length %
							2 ===
							1 && index === milestones.length - 1
							? 'lg:col-span-2'
							: ''}"
					>
						<div class="p-5">
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0">
									<p
										class="flex items-center gap-2 text-[length:var(--text-label)] font-medium text-on-surface-variant"
									>
										<Flag size={15} /> Milestone {index + 1}
									</p>
									<h4
										class="mt-2 text-xl font-semibold leading-snug break-words text-on-surface [overflow-wrap:anywhere]"
									>
										{milestone.title}
									</h4>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									<span
										class="text-[length:var(--text-label)] font-semibold {scheduleTone(
											milestone.schedule_state
										)}"
									>
										{humanize(milestone.status)}
									</span>
									{#if !project.archived && milestoneCommands(milestone).length}
										<details class="relative">
											<summary
												class="falcon-focus flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-on-surface-variant marker:content-none hover:bg-surface-container-high hover:text-on-surface"
												aria-label={`Actions for ${milestone.title}`}
											>
												<Ellipsis size={18} />
											</summary>
											<div
												class="absolute right-0 z-30 mt-2 w-[min(28rem,calc(100vw-2rem))] space-y-3 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant bg-surface-container p-4 shadow-xl"
											>
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
								</div>
							</div>
							<p
								class="mt-3 max-w-3xl text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
							>
								Done when {milestone.success_condition}
							</p>
							<div class="mt-4 flex items-center gap-3">
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

						{#if milestoneItems.length}
							<div class="divide-y divide-outline-variant/55 border-t border-outline-variant/60">
								{#each milestoneItems as item (item.id)}
									{@render workRow(item)}
								{/each}
							</div>
						{:else}
							<p class="border-t border-outline-variant/60 px-5 py-4 text-on-surface-variant">
								No work is connected to this milestone yet.
							</p>
						{/if}

						{#if milestone.status === 'achieved' && (milestone.source_refs?.length || (milestone.source_refs_omitted ?? 0) > 0)}
							<div class="border-t border-outline-variant/60 px-5 py-4">
								<SourceRefs
									sources={milestone.source_refs}
									title="How we know"
									omittedCount={milestone.source_refs_omitted ?? 0}
								/>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<div
				class="mt-3 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container-low p-5"
			>
				<EmptyState
					title="No milestones yet"
					description="Milestones will organize the work into clear outcomes."
				/>
			</div>
		{/if}

		{#if looseWork.length}
			<div
				class="mt-4 divide-y divide-outline-variant/55 overflow-visible rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container-low"
			>
				{#each looseWork as item (item.id)}
					{@render workRow(item)}
				{/each}
			</div>
		{/if}

		{#if !milestones.length && !looseWork.length}
			<div
				class="mt-4 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container-low p-5"
			>
				<EmptyState
					title="No work yet"
					description="Tasks, questions, decisions, and changes will appear here when they are connected to this project."
				/>
			</div>
		{/if}
	</section>

	{#if needsResolution.length}
		<section aria-labelledby="project-resolution-heading">
			<div class="flex items-end justify-between gap-4">
				<div>
					<h2
						id="project-resolution-heading"
						class="text-2xl font-semibold tracking-tight text-on-surface"
					>
						Needs your input
					</h2>
					<p class="mt-1 text-[length:var(--text-body)] text-on-surface-variant">
						A clear answer here keeps the project moving.
					</p>
				</div>
				<span class="text-[length:var(--text-label)] font-medium text-status-warning">
					{needsResolution.length} waiting
				</span>
			</div>
			<div class="mt-3 grid gap-3 lg:grid-cols-2">
				{#each needsResolution as item (item.id)}
					{@render resolutionRow(item)}
				{/each}
			</div>
		</section>
	{/if}

	<section
		class="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]"
		aria-label="Project details"
	>
		<div
			class="overflow-hidden rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
		>
			<div class="border-b border-outline-variant/60 px-5 py-5">
				<div class="flex items-center gap-3">
					<span
						class="flex size-10 items-center justify-center rounded-full bg-status-active-bg text-status-active"
					>
						<Check size={20} />
					</span>
					<div>
						<h2 class="text-xl font-semibold text-on-surface">Finish line</h2>
						<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
							What must be true before this project is done.
						</p>
					</div>
				</div>
			</div>
			{#if criteria.length}
				<ul class="divide-y divide-outline-variant/55">
					{#each criteria as criterion (criterion.id)}
						<li class="px-5 py-4">
							<div class="flex gap-3">
								<span
									class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border {criterion.satisfied
										? 'border-status-active bg-status-active-bg text-status-active'
										: criterion.waived
											? 'border-status-warning bg-status-warning-bg text-status-warning'
											: 'border-outline-variant text-transparent'}"
									aria-hidden="true"
								>
									<Check size={15} />
								</span>
								<div class="min-w-0 flex-1">
									<p
										class="text-[length:var(--text-body)] leading-relaxed break-words text-on-surface [overflow-wrap:anywhere]"
									>
										{criterion.text}
									</p>
									<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
										{criterion.satisfied ? 'Complete' : criterion.waived ? 'Waived' : 'Still open'}
									</p>
								</div>
							</div>
							{#if criterion.waived}
								<p class="mt-2 pl-9 text-[length:var(--text-label)] text-status-warning">
									Waived by {criterion.waived.by}: {criterion.waived.reason}
								</p>
							{/if}
							{#if editableProject && !criterion.satisfied && !criterion.waived}
								<details class="mt-2 pl-9">
									<summary
										class="falcon-focus inline-flex min-h-10 cursor-pointer items-center text-[length:var(--text-label)] font-semibold text-status-warning"
									>
										Waive this item
									</summary>
									<div class="mt-2 max-w-xl">
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
				<p class="px-5 py-5 text-on-surface-variant">No finish-line items have been defined.</p>
			{/if}
		</div>

		<div class="space-y-4">
			<section
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low p-5"
			>
				<h2 class="text-xl font-semibold text-on-surface">About this project</h2>
				{#if project.why_it_matters}
					<p class="mt-3 text-[length:var(--text-label)] font-semibold text-on-surface-variant">
						Why it matters
					</p>
					<p class="mt-1 text-[length:var(--text-body)] leading-relaxed text-on-surface">
						{project.why_it_matters}
					</p>
				{/if}
				<dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-outline-variant/60 pt-4">
					<div>
						<dt class="text-[length:var(--text-label)] text-on-surface-variant">Owner</dt>
						<dd class="mt-1 break-words font-medium text-on-surface [overflow-wrap:anywhere]">
							{project.owner ?? 'Not assigned'}
						</dd>
					</div>
					<div>
						<dt class="text-[length:var(--text-label)] text-on-surface-variant">Target</dt>
						<dd class="mt-1 font-medium text-on-surface">{formatDate(project.target_at)}</dd>
					</div>
					<div class="col-span-2">
						<dt class="text-[length:var(--text-label)] text-on-surface-variant">Last updated</dt>
						<dd class="mt-1 font-medium text-on-surface">{formatDateTime(project.updated_at)}</dd>
					</div>
				</dl>
			</section>

			<details
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
			>
				<summary
					class="falcon-focus flex min-h-12 cursor-pointer items-center px-5 py-3 font-semibold text-on-surface"
				>
					Scope and details
				</summary>
				<div class="border-t border-outline-variant/60 px-5 pb-5 pt-4">
					<p class="text-[length:var(--text-label)] font-semibold text-on-surface-variant">
						In scope
					</p>
					{#if project.scope_included?.length}
						<ul class="mt-2 space-y-2 text-[length:var(--text-body)] text-on-surface">
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
						<ul class="mt-2 space-y-2 text-[length:var(--text-body)] text-on-surface">
							{#each project.scope_excluded as item (item)}
								<li class="flex gap-2"><span class="text-on-surface-variant">—</span> {item}</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-1 text-on-surface-variant">Nothing recorded</p>
					{/if}
					<dl
						class="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant/60 pt-4 text-[length:var(--text-label)]"
					>
						<div class="min-w-0">
							<dt class="text-on-surface-variant">Area</dt>
							<dd class="mt-1 break-all font-mono text-on-surface">
								{project.area_id ?? 'Not assigned'}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="text-on-surface-variant">Plan</dt>
							<dd class="mt-1 break-all font-mono text-on-surface">
								{project.plan_id ?? 'No plan attached'}
							</dd>
						</div>
						<div>
							<dt class="text-on-surface-variant">Version</dt>
							<dd class="mt-1 font-mono text-on-surface">{project.version}</dd>
						</div>
					</dl>
				</div>
			</details>

			<details
				class="rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low"
			>
				<summary
					class="falcon-focus flex min-h-12 cursor-pointer items-center px-5 py-3 font-semibold text-on-surface"
				>
					How we know
				</summary>
				<div class="space-y-3 border-t border-outline-variant/60 p-5">
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
		</div>
	</section>

	<section aria-labelledby="project-activity-heading">
		<div class="flex items-baseline justify-between gap-3">
			<div>
				<h2
					id="project-activity-heading"
					class="text-2xl font-semibold tracking-tight text-on-surface"
				>
					Activity
				</h2>
				<p class="mt-1 text-[length:var(--text-body)] text-on-surface-variant">
					Recent progress on this project.
				</p>
			</div>
			<span class="text-[length:var(--text-label)] text-on-surface-variant">
				{project.history?.length ?? 0} update{project.history?.length === 1 ? '' : 's'}
			</span>
		</div>
		{#if project.history?.length}
			<div
				class="mt-3 rounded-[calc(var(--md-sys-shape-corner-large)+0.25rem)] border border-outline-variant/70 bg-surface-container-low px-5 py-2"
			>
				<ol class="divide-y divide-outline-variant/55">
					{#each project.history.slice(0, 4) as event, index (event.id ?? index)}
						{@render activityRow(event)}
					{/each}
				</ol>
				<details class="border-t border-outline-variant/60 py-2">
					<summary
						class="falcon-focus inline-flex min-h-10 cursor-pointer items-center font-semibold text-primary"
					>
						Full history ({project.history.length})
					</summary>
					<div class="pt-3">
						<Timeline events={project.history} />
					</div>
				</details>
			</div>
		{:else}
			<p class="mt-3 text-on-surface-variant">No project activity yet.</p>
		{/if}
	</section>
</div>
