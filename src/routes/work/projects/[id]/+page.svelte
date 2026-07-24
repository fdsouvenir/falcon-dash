<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandBar,
		CommandFeedback,
		CommandForm,
		DataRow,
		EmptyState,
		PageHeader,
		Section,
		SourceRefs,
		StatTile,
		StatusBadge,
		Timeline,
		WorkItemRow
	} from '$lib/components/work/index.js';
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

	interface ProjectPhase {
		id: string;
		title: string;
		summary?: string | null;
		sequence: number;
		status: string;
		target_at?: number | null;
		open_work: number;
		work_total: number;
		work_completed: number;
		version: number;
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
		phase_id?: string | null;
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
		phases?: ProjectPhase[];
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

	interface CommandAvailability {
		command: string;
		enabled?: boolean;
		reason?: string;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const project = $derived(data.project as unknown as ProjectDetail);
	const phases = $derived(project.phases ?? []);
	const milestones = $derived(project.milestones ?? []);
	const work = $derived(project.work ?? []);
	const criteria = $derived(project.completion_criteria ?? []);
	const unscopedContributions = $derived(project.unscoped_contributions ?? []);
	const terminalProject = $derived(['completed', 'cancelled'].includes(project.status));
	const currentNext = $derived(
		!terminalProject && project.current_next_valid
			? (work.find((item) => item.id === project.current_next_item_id) ?? null)
			: null
	);
	const unphasedWork = $derived(work.filter((item) => !item.phase_id));

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

	function phaseCommands(phase: ProjectPhase): Array<string | CommandAvailability> {
		if (phase.status === 'planned') {
			return [
				{
					command: 'activate_phase',
					enabled: phase.work_total > 0,
					reason:
						phase.work_total > 0 ? undefined : 'Assign at least one work item before activation'
				},
				'skip_phase'
			];
		}
		if (phase.status === 'active') {
			return [
				{
					command: 'complete_phase',
					enabled: phase.open_work === 0,
					reason:
						phase.open_work === 0
							? undefined
							: `${phase.open_work} open work item${phase.open_work === 1 ? '' : 's'} must finish first`
				},
				'skip_phase'
			];
		}
		if (['completed', 'skipped'].includes(phase.status)) return ['reopen_phase'];
		return [];
	}

	function milestoneCommands(milestone: ProjectMilestone): string[] {
		if (milestone.status === 'planned') return ['achieve_milestone', 'cancel_milestone'];
		if (['achieved', 'cancelled'].includes(milestone.status)) return ['reopen_milestone'];
		return [];
	}

	function formatDate(value?: number | null): string {
		return value ? new Date(value).toLocaleDateString() : 'Not set';
	}

	function formatDateTime(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Not set';
	}

	function workWhy(item: ProjectWork): string {
		const details: string[] = [];
		if (item.waiting_on) details.push(`Waiting on ${item.waiting_on}`);
		if (item.due_at) details.push(`Due ${formatDate(item.due_at)}`);
		if (item.status === 'rolled_back') {
			details.push('Rollback completed');
		} else if (item.rollback_started_at) {
			details.push(`Rollback in progress since ${formatDateTime(item.rollback_started_at)}`);
		} else if (item.secondary_state) {
			details.push(`Verification ${item.secondary_state.replaceAll('_', ' ')}`);
		}
		return details.join(' · ') || `Work ID ${item.id}`;
	}

	function riskTone(severity: 'danger' | 'warning' | 'muted'): string {
		if (severity === 'danger') return 'bg-status-danger';
		if (severity === 'warning') return 'bg-status-warning';
		return 'bg-status-muted';
	}
</script>

<svelte:head><title>{project.title} — Project Ledger</title></svelte:head>

<div class="space-y-5">
	<PageHeader
		eyebrow="Project ledger"
		title={project.title}
		id={project.id}
		version={project.version}
		status={project.status}
		statusType="project"
		description={project.desired_outcome ?? project.summary}
		backHref={resolve('/work/projects')}
		backLabel="Projects"
	>
		{#snippet metadata()}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				<StatusBadge
					type="project_health"
					value={project.health}
					label={`${project.health.replaceAll('_', ' ')} health`}
				/>
				<span class="text-[length:var(--text-label)] text-on-surface-variant">
					{project.health_reason}
				</span>
			</div>
		{/snippet}
		{#snippet actions()}
			<details
				class="w-[min(90vw,42rem)] rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container"
			>
				<summary
					class="falcon-focus touch-target cursor-pointer rounded-[var(--md-sys-shape-corner-medium)] px-4 py-3 font-semibold text-primary"
				>
					Project actions
				</summary>
				<div class="border-t border-outline-variant/70 p-3">
					<CommandBar
						commands={lifecycleCommands}
						targetId={project.id}
						expectedVersion={project.version}
						form={form as never}
						title="Project lifecycle"
					/>
				</div>
			</details>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />

	<div class="grid min-w-0 gap-5 xl:grid-cols-[14rem_minmax(0,1fr)_23rem]">
		<aside class="hidden xl:block">
			<nav
				class="sticky top-4 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container p-3"
				aria-label="Project ledger sections"
			>
				<p
					class="px-2 pb-2 font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
				>
					Ledger sections
				</p>
				{#each [['status', '01', 'Status'], ['route', '02', 'Route'], ['proof', '03', 'Proof'], ['current-work', '04', 'Current work'], ['history', '05', 'History']] as anchor (anchor[0])}
					<a
						href={`#${anchor[0]}`}
						class="falcon-focus touch-target flex items-center gap-3 rounded-[var(--md-sys-shape-corner-small)] px-2 text-[length:var(--text-body)] font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
					>
						<span class="font-mono text-[length:var(--text-label)]">{anchor[1]}</span>
						<span>{anchor[2]}</span>
					</a>
				{/each}
			</nav>
		</aside>

		<main class="min-w-0 space-y-5">
			<Section
				id="status"
				title="Status"
				description="Derived health, finish-line progress, current next work, and operator risk signals."
				accent={project.health === 'blocked'
					? 'danger'
					: project.health === 'at_risk'
						? 'warning'
						: 'default'}
			>
				<div class="grid grid-cols-2 gap-3">
					<StatTile
						label="Criteria"
						value={project.progress.criteria}
						description="Satisfied or waived"
						tone="active"
					/>
					<StatTile
						label="Milestones"
						value={project.progress.milestones}
						description="Achieved checkpoints"
						tone="info"
					/>
					<StatTile
						label="Open work"
						value={project.progress.work_open}
						description="Non-terminal Work"
						tone="purple"
					/>
					<StatTile
						label="Blocked"
						value={project.progress.work_blocked}
						description="Active blockers"
						tone={project.progress.work_blocked ? 'danger' : 'muted'}
					/>
				</div>

				<div
					class="mt-5 rounded-[var(--md-sys-shape-corner-medium)] border border-primary/35 bg-primary-container/25 p-4"
				>
					<p
						class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.12em] text-primary"
					>
						{project.archived ? 'Saved current next' : 'Current next'}
					</p>
					{#if currentNext}
						<div class="mt-2">
							<WorkItemRow
								type={currentNext.type}
								id={currentNext.id}
								title={currentNext.title}
								status={currentNext.status}
								why={workWhy(currentNext)}
							/>
						</div>
						{#if project.current_next_item_id && !project.archived}
							<CommandForm
								command="set_current_next_item"
								targetId={project.id}
								expectedVersion={project.version}
								form={form as never}
								presetValues={{ item_id: '' }}
								submitLabel="Clear current next item"
								compact
							/>
						{/if}
					{:else}
						<p class="mt-2 text-on-surface-variant">
							{project.current_next_item_id
								? project.archived
									? `Configured item ${project.current_next_item_id} is missing, terminal, or outside this Project. Clear this legacy pointer; restore the Project before choosing work.`
									: terminalProject
										? `Configured item ${project.current_next_item_id} is missing, terminal, or outside this Project. Clear this legacy pointer; reopen the Project before choosing work.`
										: `Configured item ${project.current_next_item_id} is missing, terminal, or outside this Project. Clear it, then choose a non-terminal item under Current work.`
								: project.archived
									? 'Archived Projects do not have a current next item. Restore the Project before choosing work.'
									: terminalProject
										? `${project.status === 'completed' ? 'Completed' : 'Cancelled'} Projects do not have a current next item. Reopen the Project before choosing work.`
										: 'No current next item is set. Choose a non-terminal item under Current work.'}
						</p>
						{#if project.current_next_item_id}
							<div class="mt-2">
								<CommandForm
									command="set_current_next_item"
									targetId={project.id}
									expectedVersion={project.version}
									form={form as never}
									presetValues={{ item_id: '' }}
									submitLabel="Clear invalid current next item"
									compact
								/>
							</div>
						{/if}
					{/if}
				</div>

				<div class="mt-5">
					<h3 class="font-semibold text-on-surface">Risk flags</h3>
					{#if project.risk_flags?.length}
						<ul class="mt-3 space-y-2">
							{#each project.risk_flags as flag (flag.key)}
								<li
									class="flex gap-3 rounded-[var(--md-sys-shape-corner-small)] bg-surface-container-high px-3 py-2 text-[length:var(--text-body)] text-on-surface"
								>
									<span
										class="mt-1.5 size-2 shrink-0 rounded-full {riskTone(flag.severity)}"
										aria-hidden="true"
									></span>
									{flag.label}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-2 text-on-surface-variant">No derived project risks are active.</p>
					{/if}
				</div>
			</Section>

			<Section
				id="route"
				title="Route"
				description="Ordered phases and their server-derived work progress."
				accent="purple"
			>
				{#if phases.length}
					<ol class="space-y-3">
						{#each phases as phase (phase.id)}
							<li
								class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
							>
								<div class="flex flex-wrap items-start justify-between gap-3">
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											<span
												class="font-mono text-[length:var(--text-label)] text-on-surface-variant"
											>
												{String(phase.sequence).padStart(2, '0')}
											</span>
											<h3 class="font-semibold text-on-surface">{phase.title}</h3>
											<StatusBadge type="phase" value={phase.status} />
										</div>
										{#if phase.summary}
											<p class="mt-2 text-[length:var(--text-body)] text-on-surface-variant">
												{phase.summary}
											</p>
										{/if}
									</div>
									<p class="text-[length:var(--text-label)] text-on-surface-variant">
										{phase.work_completed}/{phase.work_total} terminal · {phase.open_work} open
									</p>
								</div>
								<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container">
									<div
										class="h-full rounded-full bg-status-purple"
										style={`width: ${phase.work_total ? Math.round((phase.work_completed / phase.work_total) * 100) : 0}%`}
									></div>
								</div>
								<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
									<span class="text-[length:var(--text-label)] text-on-surface-variant">
										Target {formatDate(phase.target_at)}
									</span>
									{#if !project.archived && phaseCommands(phase).length}
										<details>
											<summary
												class="falcon-focus touch-target cursor-pointer rounded px-2 font-semibold text-primary"
											>
												Manage phase
											</summary>
											<div class="mt-2 max-w-xl">
												<CommandBar
													commands={phaseCommands(phase)}
													targetId={phase.id}
													expectedVersion={phase.version}
													form={form as never}
													title={`${phase.title} actions`}
												/>
											</div>
										</details>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				{:else}
					<EmptyState
						title="No phases yet"
						description="Add the first ordered phase from the operating brief."
					/>
				{/if}
			</Section>

			<Section
				id="proof"
				title="Proof"
				description="Contributions show relevant work; only active satisfaction assertions or explicit waivers close criteria."
				accent="info"
			>
				<div class="space-y-6">
					<div>
						<h3 class="font-semibold text-on-surface">Project contributions</h3>
						<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
							Relevant Work linked to the Project outcome without claiming a completion criterion.
						</p>
						{#if unscopedContributions.length}
							<div class="mt-3 divide-y divide-outline-variant/60">
								{#each unscopedContributions as link (link.id)}
									<div class="py-2">
										<WorkItemRow
											type={link.source_type}
											id={link.source_id}
											title={link.source_id}
											why="Contributes to the Project outcome"
										/>
										{#if link.source_refs?.length || (link.source_refs_omitted ?? 0) > 0}
											<SourceRefs
												sources={link.source_refs ?? []}
												title="Contribution sources"
												omittedCount={link.source_refs_omitted ?? 0}
											/>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="mt-2 text-on-surface-variant">No unscoped Project contribution links.</p>
						{/if}
					</div>

					<div>
						<h3 class="font-semibold text-on-surface">Completion criteria</h3>
						{#if criteria.length}
							<ul class="mt-3 space-y-3">
								{#each criteria as criterion (criterion.id)}
									<li
										class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
									>
										<div class="flex flex-wrap items-start justify-between gap-3">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span
														class="font-mono text-[length:var(--text-label)] text-on-surface-variant"
													>
														{criterion.id}
													</span>
													<StatusBadge
														type="review"
														value={criterion.satisfied
															? 'approved'
															: criterion.waived
																? 'changes_requested'
																: 'unreviewed'}
														label={criterion.satisfied
															? 'Satisfied'
															: criterion.waived
																? 'Waived'
																: 'Open'}
													/>
												</div>
												<p class="mt-2 font-medium text-on-surface">{criterion.text}</p>
											</div>
											{#if !project.archived && !criterion.satisfied && !criterion.waived}
												<details class="max-w-md">
													<summary
														class="falcon-focus touch-target cursor-pointer rounded px-2 text-[length:var(--text-label)] font-semibold text-status-warning"
													>
														Waive under authority
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
										</div>
										{#if criterion.waived}
											<p class="mt-3 text-[length:var(--text-label)] text-status-warning">
												Waived by {criterion.waived.by}: {criterion.waived.reason}
											</p>
										{/if}
										<div class="mt-3 grid gap-3 sm:grid-cols-2">
											<div>
												<p
													class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
												>
													Contributes
												</p>
												{#if criterion.contributions.length}
													<ul class="mt-1 space-y-2">
														{#each criterion.contributions as link (link.id)}
															<li class="text-[length:var(--text-label)] text-on-surface-variant">
																<p class="font-mono">{link.source_id}</p>
																{#if link.source_refs?.length || (link.source_refs_omitted ?? 0) > 0}
																	<SourceRefs
																		sources={link.source_refs ?? []}
																		title="Criterion contribution sources"
																		omittedCount={link.source_refs_omitted ?? 0}
																	/>
																{/if}
															</li>
														{/each}
													</ul>
												{:else}
													<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
														No contribution links
													</p>
												{/if}
											</div>
											<div>
												<p
													class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
												>
													Satisfies
												</p>
												{#if criterion.satisfactions.length}
													<ul class="mt-1 space-y-2">
														{#each criterion.satisfactions as link (link.id)}
															<li
																class="rounded-[var(--md-sys-shape-corner-small)] bg-surface-container px-2 py-2"
															>
																<p
																	class="font-mono text-[length:var(--text-label)] text-on-surface"
																>
																	{link.source_id} · revision {link.source_revision ??
																		'not recorded'}
																</p>
																<div class="mt-2">
																	<SourceRefs
																		sources={link.source_refs ?? []}
																		title="Satisfaction sources"
																		omittedCount={link.source_refs_omitted ?? 0}
																	/>
																</div>
															</li>
														{/each}
													</ul>
												{:else}
													<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
														No active satisfaction proof
													</p>
												{/if}
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-2 text-on-surface-variant">No completion criteria are defined.</p>
						{/if}
					</div>

					<div class="border-t border-outline-variant/70 pt-5">
						<h3 class="font-semibold text-on-surface">Milestones</h3>
						{#if milestones.length}
							<ul class="mt-3 space-y-3">
								{#each milestones as milestone (milestone.id)}
									<li
										class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
									>
										<div class="flex flex-wrap items-start justify-between gap-3">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<h4 class="font-semibold text-on-surface">{milestone.title}</h4>
													<StatusBadge type="milestone" value={milestone.status} />
													{#if milestone.schedule_state !== 'none'}
														<StatusBadge
															type="schedule"
															value={milestone.schedule_state}
															label={milestone.schedule_state.replaceAll('_', ' ')}
														/>
													{/if}
												</div>
												<p class="mt-2 text-[length:var(--text-body)] text-on-surface">
													Success when: {milestone.success_condition}
												</p>
												<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
													Target {formatDate(milestone.target_at)}
												</p>
											</div>
										</div>
										{#if milestone.status === 'achieved' && (milestone.source_refs?.length || (milestone.source_refs_omitted ?? 0) > 0)}
											<div class="mt-3">
												<SourceRefs
													sources={milestone.source_refs}
													title="Achievement sources"
													omittedCount={milestone.source_refs_omitted ?? 0}
												/>
											</div>
										{/if}
										{#if milestone.status === 'achieved' && milestone.waived_sources_reason}
											<p class="mt-3 text-[length:var(--text-label)] text-status-warning">
												Sources waived: {milestone.waived_sources_reason}
											</p>
										{/if}
										{#if milestone.status !== 'achieved' && milestone.proof_historical && (milestone.source_refs?.length || (milestone.source_refs_omitted ?? 0) > 0)}
											<div class="mt-3">
												<SourceRefs
													sources={milestone.source_refs}
													title="Historical achievement sources"
													omittedCount={milestone.source_refs_omitted ?? 0}
												/>
											</div>
										{/if}
										{#if milestone.status !== 'achieved' && milestone.proof_historical && milestone.waived_sources_reason}
											<p class="mt-3 text-[length:var(--text-label)] text-on-surface-variant">
												Historical source waiver: {milestone.waived_sources_reason}
											</p>
										{/if}
										<div class="mt-3 grid gap-3 sm:grid-cols-2">
											<div>
												<p
													class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
												>
													Contributes
												</p>
												{#if milestone.contributions?.length}
													<ul class="mt-1 space-y-2">
														{#each milestone.contributions as link (link.id)}
															<li class="text-[length:var(--text-label)] text-on-surface-variant">
																<p class="font-mono">{link.source_id}</p>
																{#if link.source_refs?.length || (link.source_refs_omitted ?? 0) > 0}
																	<SourceRefs
																		sources={link.source_refs ?? []}
																		title="Milestone contribution sources"
																		omittedCount={link.source_refs_omitted ?? 0}
																	/>
																{/if}
															</li>
														{/each}
													</ul>
												{:else}
													<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
														No contribution links
													</p>
												{/if}
											</div>
											<div>
												<p
													class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
												>
													Satisfies
												</p>
												{#if milestone.satisfactions?.length}
													<ul class="mt-1 space-y-2">
														{#each milestone.satisfactions as link (link.id)}
															<li
																class="rounded-[var(--md-sys-shape-corner-small)] bg-surface-container px-2 py-2"
															>
																<p
																	class="font-mono text-[length:var(--text-label)] text-on-surface"
																>
																	{link.source_id} · revision {link.source_revision ??
																		'not recorded'}
																</p>
																<SourceRefs
																	sources={link.source_refs ?? []}
																	title="Milestone satisfaction sources"
																	omittedCount={link.source_refs_omitted ?? 0}
																/>
															</li>
														{/each}
													</ul>
												{:else}
													<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
														No active satisfaction proof
													</p>
												{/if}
												{#if milestone.historical_satisfactions?.length}
													<p
														class="mt-3 font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
													>
														Historical satisfactions
													</p>
													<ul class="mt-1 space-y-2">
														{#each milestone.historical_satisfactions as link (link.id)}
															<li
																class="rounded-[var(--md-sys-shape-corner-small)] bg-surface-container px-2 py-2"
															>
																<p
																	class="font-mono text-[length:var(--text-label)] text-on-surface"
																>
																	{link.source_id} · revision {link.source_revision ??
																		'not recorded'}
																</p>
																{#if link.invalidated_reason}
																	<p
																		class="mt-1 text-[length:var(--text-label)] text-on-surface-variant"
																	>
																		{link.invalidated_reason}
																	</p>
																{/if}
																<div class="mt-2">
																	<SourceRefs
																		sources={link.source_refs ?? []}
																		title="Historical satisfaction sources"
																		omittedCount={link.source_refs_omitted ?? 0}
																	/>
																</div>
															</li>
														{/each}
													</ul>
												{/if}
											</div>
										</div>
										{#if !project.archived && milestoneCommands(milestone).length}
											<details class="mt-3">
												<summary
													class="falcon-focus touch-target cursor-pointer rounded px-2 font-semibold text-primary"
												>
													Manage milestone
												</summary>
												<div class="mt-2">
													<CommandBar
														commands={milestoneCommands(milestone)}
														targetId={milestone.id}
														expectedVersion={milestone.version}
														form={form as never}
														title={`${milestone.title} actions`}
														requireExactlyOneOfByCommand={{
															achieve_milestone: ['source_refs', 'waive_sources_reason']
														}}
													/>
												</div>
											</details>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="mt-2 text-on-surface-variant">No milestones are defined.</p>
						{/if}
					</div>
				</div>
			</Section>

			<Section
				id="current-work"
				title="Current work"
				description="Tasks, questions, decisions, and change requests in Project context."
				accent="purple"
			>
				{#if work.length}
					<div class="space-y-5">
						{#each phases as phase (phase.id)}
							{@const phaseWork = work.filter((item) => item.phase_id === phase.id)}
							{#if phaseWork.length}
								<div>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<h3 class="font-semibold text-on-surface">{phase.title}</h3>
										<span class="text-[length:var(--text-label)] text-on-surface-variant">
											{phaseWork.length} item{phaseWork.length === 1 ? '' : 's'}
										</span>
									</div>
									<div class="mt-2 divide-y divide-outline-variant/60">
										{#each phaseWork as item (item.id)}
											<div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
												<WorkItemRow
													type={item.type}
													id={item.id}
													title={item.title}
													status={item.status}
													why={workWhy(item)}
												/>
												{#if !project.archived && !item.terminal && item.id !== project.current_next_item_id && !terminalProject}
													<CommandForm
														command="set_current_next_item"
														targetId={project.id}
														expectedVersion={project.version}
														form={form as never}
														presetValues={{ item_id: item.id }}
														confirmationSubject={item.title}
														compact
													/>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
						{#if unphasedWork.length}
							<div>
								<h3 class="font-semibold text-on-surface">Unphased work</h3>
								<div class="mt-2 divide-y divide-outline-variant/60">
									{#each unphasedWork as item (item.id)}
										<div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
											<WorkItemRow
												type={item.type}
												id={item.id}
												title={item.title}
												status={item.status}
												why={workWhy(item)}
											/>
											{#if !project.archived && !item.terminal && item.id !== project.current_next_item_id && !terminalProject}
												<CommandForm
													command="set_current_next_item"
													targetId={project.id}
													expectedVersion={project.version}
													form={form as never}
													presetValues={{ item_id: item.id }}
													confirmationSubject={item.title}
													compact
												/>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<EmptyState
						title="No current work"
						description="This Project has no assigned tasks, questions, decisions, or changes."
					/>
				{/if}
			</Section>

			<Section
				id="history"
				title="History"
				description="Immutable project events, authority acts, and version transitions."
			>
				{#if project.history?.length}
					<Timeline events={project.history} />
				{:else}
					<EmptyState title="No history yet" description="Project events will appear here." />
				{/if}
			</Section>
		</main>

		<aside class="min-w-0 space-y-5 xl:order-none">
			<div class="space-y-5 xl:sticky xl:top-4">
				<Section
					title="Operating brief"
					description="The pinned outcome, boundary, ownership, and route context."
					accent="info"
				>
					<dl>
						<DataRow label="Outcome" value={project.desired_outcome ?? 'Not defined'} />
						<DataRow label="Why" value={project.why_it_matters ?? 'Not defined'} />
						<DataRow label="Owner" value={project.owner ?? 'Unassigned'} />
						<DataRow label="Target" value={formatDate(project.target_at)} />
						<DataRow label="Area" value={project.area_id ?? 'Not assigned'} mono />
						<DataRow label="Plan" value={project.plan_id ?? 'No plan attached'} mono />
						<DataRow label="Updated" value={formatDateTime(project.updated_at)} />
					</dl>
					<div class="mt-4 border-t border-outline-variant/70 pt-4">
						<p
							class="font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
						>
							In scope
						</p>
						<p class="mt-1 text-[length:var(--text-body)] text-on-surface">
							{project.scope_included?.join(' · ') || 'Not defined'}
						</p>
						<p
							class="mt-4 font-mono text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-on-surface-variant"
						>
							Out of scope
						</p>
						<p class="mt-1 text-[length:var(--text-body)] text-on-surface">
							{project.scope_excluded?.join(' · ') || 'Nothing recorded'}
						</p>
					</div>
				</Section>

				<Section
					title="Structure"
					description="The only in-product creation controls: Project-local phases and milestones."
					accent="purple"
				>
					{#if project.archived}
						<p class="text-[length:var(--text-body)] text-on-surface-variant">
							Restore this Project before changing its Phase or Milestone structure.
						</p>
					{:else}
						<div class="space-y-3">
							<details
								class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high"
							>
								<summary
									class="falcon-focus touch-target cursor-pointer rounded-[var(--md-sys-shape-corner-medium)] px-3 font-semibold text-primary"
								>
									Add phase
								</summary>
								<div class="border-t border-outline-variant/60 p-3">
									<CommandForm
										command="create_phase"
										form={form as never}
										presetValues={{ project_id: project.id }}
										compact
									/>
								</div>
							</details>
							<details
								class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high"
							>
								<summary
									class="falcon-focus touch-target cursor-pointer rounded-[var(--md-sys-shape-corner-medium)] px-3 font-semibold text-primary"
								>
									Add milestone
								</summary>
								<div class="border-t border-outline-variant/60 p-3">
									<CommandForm
										command="create_milestone"
										form={form as never}
										presetValues={{ project_id: project.id }}
										compact
									/>
								</div>
							</details>
						</div>
					{/if}
				</Section>
			</div>
		</aside>
	</div>
</div>
