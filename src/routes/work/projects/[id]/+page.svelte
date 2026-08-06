<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
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

	interface WorkGroup {
		key: string;
		milestone: ProjectMilestone | null;
		items: ProjectWork[];
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
	const editableProject = $derived(!project.archived && !terminalProject);
	const attentionFlags = $derived(
		(project.risk_flags ?? []).filter(
			(flag) => flag.severity !== 'muted' && flag.key !== 'blocked_work'
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

	const workGroups = $derived.by<WorkGroup[]>(() => {
		const groups: WorkGroup[] = [];
		const milestoneGroups = new SvelteMap<string, WorkGroup>();
		for (const item of [...work].sort(compareWork)) {
			const milestone = item.milestone_id
				? (milestones.find((candidate) => candidate.id === item.milestone_id) ?? null)
				: null;
			if (!milestone) {
				groups.push({ key: item.id, milestone: null, items: [item] });
				continue;
			}
			const existing = milestoneGroups.get(milestone.id);
			if (existing) {
				existing.items.push(item);
				continue;
			}
			const group = { key: milestone.id, milestone, items: [item] };
			milestoneGroups.set(milestone.id, group);
			groups.push(group);
		}
		return groups;
	});

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

	function projectAttention(): string {
		if (project.archived) return 'Archived — restore it to make changes.';
		if (project.health === 'blocked') return 'Blocked — the current next move cannot proceed.';
		if (project.health === 'at_risk') return 'Needs attention — timing or blocked work is at risk.';
		if (project.status === 'active' && !project.current_next_valid) {
			return 'Needs a next move — choose one from the work below.';
		}
		if (project.status === 'active') return 'Moving forward — the current next move is actionable.';
		if (project.status === 'planned') return 'Ready to start when its prerequisites are in place.';
		if (project.status === 'draft') return 'Still being defined.';
		if (project.status === 'paused') return 'Paused until work is ready to resume.';
		if (project.status === 'completed') return 'Finished.';
		return 'Cancelled.';
	}

	function attentionTone(): string {
		return project.health === 'blocked' ||
			project.health === 'at_risk' ||
			(project.status === 'active' && !project.current_next_valid)
			? 'text-primary'
			: 'text-on-surface-variant';
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
		class="group/row relative grid min-w-0 gap-3 px-3 py-3 hover:bg-surface-container-high md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
		data-project-work-row
	>
		<div class="flex items-start gap-3 md:contents">
			<WorkGlyph type={item.type} size={28} />
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
						{item.id}
					</span>
					<span class="text-[length:var(--text-label)] text-on-surface-variant">
						{typeLabel(item.type)}
					</span>
					{#if item.id === project.current_next_item_id && project.current_next_valid}
						<span
							class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.08em] text-primary"
						>
							Current next
						</span>
					{/if}
				</div>
				<a
					href={workHref(item.type, item.id)}
					class="falcon-focus mt-0.5 block rounded font-medium text-on-surface hover:text-primary"
				>
					{item.title}
				</a>
				<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[length:var(--text-label)]">
					<span class={item.terminal ? 'text-on-surface-variant' : 'text-on-surface'}>
						{humanize(item.status)}
					</span>
					{#if item.due_at}
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
						<span class="text-on-surface-variant">{workMeta(item)}</span>
					{/if}
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

<svelte:head><title>{project.title} — Project</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-4">
	<a
		href={resolve('/work/projects')}
		class="falcon-focus touch-target inline-flex items-center rounded text-[length:var(--text-label)] font-semibold text-primary hover:text-primary/80"
	>
		← Projects
	</a>

	<header class="border-b border-outline-variant/70 pb-4">
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
						{project.id} · v{project.version}
					</span>
					<span
						class="text-[length:var(--text-label)] font-semibold {lifecycleTone(project.status)}"
					>
						{humanize(project.status)}
					</span>
				</div>
				<h1 class="mt-1 break-words text-2xl font-semibold tracking-tight text-on-surface">
					{project.title}
				</h1>
				{#if project.desired_outcome ?? project.summary}
					<p
						class="mt-2 line-clamp-2 max-w-4xl text-[length:var(--text-body)] leading-relaxed text-on-surface-variant"
						title={project.desired_outcome ?? project.summary ?? undefined}
					>
						{project.desired_outcome ?? project.summary}
					</p>
				{/if}
				<p class="mt-2 text-[length:var(--text-body)] font-medium {attentionTone()}">
					{projectAttention()}
				</p>
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

		<div
			class="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-outline-variant/60 pt-3 text-[length:var(--text-label)] text-on-surface-variant"
		>
			<span
				><strong class="font-mono text-on-surface">{project.progress.criteria}</strong> finish-line items</span
			>
			<span
				><strong class="font-mono text-on-surface">{project.progress.milestones}</strong> milestones</span
			>
			<span
				><strong class="font-mono text-on-surface">{project.progress.work_open}</strong> open work</span
			>
			{#if project.progress.work_blocked > 0}
				<span class="text-status-danger"
					><strong class="font-mono">{project.progress.work_blocked}</strong> blocked</span
				>
			{/if}
			{#if project.target_at}<span>Target {formatDate(project.target_at)}</span>{/if}
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

	<div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
		<main class="min-w-0 space-y-4">
			<section
				class="overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
				aria-labelledby="project-work-heading"
			>
				<div
					class="flex items-baseline justify-between gap-3 border-b border-outline-variant/70 px-4 py-3"
				>
					<h2 id="project-work-heading" class="font-semibold text-on-surface">Work</h2>
					<p class="text-[length:var(--text-label)] text-on-surface-variant">
						{work.length} item{work.length === 1 ? '' : 's'} · ordered by due date
					</p>
				</div>
				{#if workGroups.length}
					<div class="divide-y divide-outline-variant/70">
						{#each workGroups as group (group.key)}
							<div class="relative">
								{#if group.milestone}
									<div class="flex gap-3 bg-surface-container-high/60 px-3 py-3">
										<WorkGlyph type="milestone" size={28} />
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
												<span
													class="font-mono text-[length:var(--text-label)] text-on-surface-variant"
												>
													Milestone {group.milestone.sequence}
												</span>
												<h3 class="font-semibold text-on-surface">{group.milestone.title}</h3>
												<span
													class="text-[length:var(--text-label)] font-semibold {scheduleTone(
														group.milestone.schedule_state
													)}"
												>
													{humanize(group.milestone.status)}
												</span>
											</div>
											<p
												class="mt-1 line-clamp-2 text-[length:var(--text-label)] text-on-surface-variant"
												title={`Finish when ${group.milestone.success_condition}`}
											>
												Finish when {group.milestone.success_condition}
												{group.milestone.target_at
													? ` · Target ${formatDate(group.milestone.target_at)}`
													: ''}
											</p>
										</div>
									</div>
								{/if}
								<div class="divide-y divide-outline-variant/60">
									{#each group.items as item (item.id)}
										{@render workRow(item)}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="p-4">
						<EmptyState
							title="No work yet"
							description="Tasks, questions, decisions, and changes will appear here when they are connected to this project."
						/>
					</div>
				{/if}
			</section>

			<details
				class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
			>
				<summary
					class="falcon-focus touch-target cursor-pointer px-4 py-3 font-semibold text-on-surface"
				>
					History <span class="font-normal text-on-surface-variant"
						>({project.history?.length ?? 0})</span
					>
				</summary>
				<div class="border-t border-outline-variant/70 p-4">
					{#if project.history?.length}
						<Timeline events={project.history} />
					{:else}
						<p class="text-on-surface-variant">No project history yet.</p>
					{/if}
				</div>
			</details>
		</main>

		<aside class="min-w-0 space-y-4 xl:sticky xl:top-4">
			<section
				class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
			>
				<div class="border-b border-outline-variant/70 px-4 py-3">
					<h2 class="font-semibold text-on-surface">Finish line</h2>
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
				class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
			>
				<div
					class="flex items-center justify-between gap-3 border-b border-outline-variant/70 px-4 py-3"
				>
					<h2 class="font-semibold text-on-surface">Milestones</h2>
					<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant"
						>{milestones.length}</span
					>
				</div>
				{#if milestones.length}
					<ol class="divide-y divide-outline-variant/60">
						{#each milestones as milestone (milestone.id)}
							<li class="px-4 py-3">
								<div class="flex items-start gap-3">
									<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
										{String(milestone.sequence).padStart(2, '0')}
									</span>
									<div class="min-w-0 flex-1">
										<h3 class="font-semibold text-on-surface">{milestone.title}</h3>
										<p
											class="mt-1 text-[length:var(--text-label)] {scheduleTone(
												milestone.schedule_state
											)}"
										>
											{humanize(milestone.status)}{milestone.target_at
												? ` · ${formatDate(milestone.target_at)}`
												: ''}
										</p>
										<p
											class="mt-2 text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
										>
											Finish when {milestone.success_condition}
										</p>
									</div>
								</div>
								{#if milestone.status === 'achieved' && (milestone.source_refs?.length || (milestone.source_refs_omitted ?? 0) > 0)}
									<div class="mt-2">
										<SourceRefs
											sources={milestone.source_refs}
											title="How we know"
											omittedCount={milestone.source_refs_omitted ?? 0}
										/>
									</div>
								{/if}
								{#if !project.archived && milestoneCommands(milestone).length}
									<details class="mt-2">
										<summary
											class="falcon-focus touch-target cursor-pointer text-[length:var(--text-label)] font-semibold text-primary"
										>
											Manage milestone
										</summary>
										<div class="mt-2 space-y-3">
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
							</li>
						{/each}
					</ol>
				{:else}
					<p class="px-4 py-4 text-on-surface-variant">No milestones yet.</p>
				{/if}
				{#if !project.archived}
					<details class="border-t border-outline-variant/70 px-4 py-2">
						<summary
							class="falcon-focus touch-target cursor-pointer text-[length:var(--text-label)] font-semibold text-primary"
						>
							Add milestone
						</summary>
						<div class="pb-2 pt-2">
							<CommandForm
								command="create_milestone"
								form={form as never}
								presetValues={{ project_id: project.id }}
								compact
							/>
						</div>
					</details>
				{/if}
			</section>

			<details
				open
				class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
			>
				<summary
					class="falcon-focus touch-target cursor-pointer px-4 py-3 font-semibold text-on-surface"
				>
					Project details
				</summary>
				<div class="border-t border-outline-variant/70 px-4 pb-4">
					<dl>
						<DataRow label="Why it matters" value={project.why_it_matters ?? 'Not defined'} />
						<DataRow label="Owner" value={project.owner ?? 'Not assigned'} />
						<DataRow label="Target" value={formatDate(project.target_at)} />
						<DataRow label="Area" value={project.area_id ?? 'Not assigned'} mono />
						<DataRow label="Plan" value={project.plan_id ?? 'No plan attached'} mono />
						<DataRow label="Updated" value={formatDateTime(project.updated_at)} />
					</dl>
					<div class="border-t border-outline-variant/70 pt-3">
						<p class="text-[length:var(--text-label)] font-semibold text-on-surface-variant">
							In scope
						</p>
						<p class="mt-1 text-[length:var(--text-body)] text-on-surface">
							{project.scope_included?.join(' · ') || 'Not defined'}
						</p>
						<p class="mt-3 text-[length:var(--text-label)] font-semibold text-on-surface-variant">
							Out of scope
						</p>
						<p class="mt-1 text-[length:var(--text-body)] text-on-surface">
							{project.scope_excluded?.join(' · ') || 'Nothing recorded'}
						</p>
					</div>
				</div>
			</details>

			<details
				class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
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
