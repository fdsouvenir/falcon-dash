<script lang="ts">
	import { resolve } from '$app/paths';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
	import { literalBlockersFor, projectHealth, riskFlagsFor } from '$lib/work/work-insights.js';
	import {
		formatDate,
		formatDateTime,
		formatStatus,
		itemDisplayId,
		openStatuses,
		pathForType,
		priorityTone,
		sentenceCase,
		statusTone,
		waitingLabel,
		workStatuses,
		type WorkItem,
		type WorkItemType,
		type WorkPriority,
		type WorkStatus
	} from '$lib/work/work-ui.js';
	import { ArrowRight, Save } from '@lucide/svelte';

	type ProjectLedgerDraft = {
		status: WorkStatus;
		priority: WorkPriority;
		waiting_on: string;
	};

	type ProjectLedgerAnchor = {
		id: string;
		number: string;
		label: string;
	};

	type ProjectPlanGroup = {
		id: string;
		title: string;
		description: string;
		milestone: WorkItem | null;
		work: WorkItem[];
	};

	let {
		item,
		items,
		draft = $bindable(),
		saving,
		saveMessage,
		error,
		onSave
	}: {
		item: WorkItem;
		items: WorkItem[];
		draft: ProjectLedgerDraft;
		saving: boolean;
		saveMessage: string | null;
		error: string | null;
		onSave: (event: SubmitEvent) => void;
	} = $props();

	const waitingOptions = [
		{ value: '', label: 'No blocker' },
		{ value: 'operator', label: 'Operator' },
		{ value: 'agent', label: 'Agent' },
		{ value: 'external', label: 'External' },
		{ value: 'system', label: 'System' }
	];

	const anchors: ProjectLedgerAnchor[] = [
		{ id: 'project-brief', number: '01', label: 'Brief' },
		{ id: 'project-current-work', number: '02', label: 'Current Work' },
		{ id: 'project-plan', number: '03', label: 'Project Plan' },
		{ id: 'project-signals', number: '04', label: 'Signals' },
		{ id: 'project-activity', number: '05', label: 'Activity' }
	];

	const planWorkTypes: WorkItemType[] = [
		'next_step',
		'change_request',
		'decision',
		'open_question'
	];

	const directChildren = $derived(
		items.filter((candidate) => candidate.parent_item_id === item.id)
	);
	const milestones = $derived(sortProjectItems(directChildren.filter(isMilestone)));
	const milestoneChildren = $derived(
		items.filter((candidate) =>
			milestones.some((milestone) => candidate.parent_item_id === milestone.id)
		)
	);
	const children = $derived(uniqueItems([...directChildren, ...milestoneChildren]));
	const health = $derived(projectHealth(item, children));
	const healthReasons = $derived(riskFlagsFor(item, children));
	const blockers = $derived(literalBlockersFor(item, children));
	const waitingItems = $derived(
		children
			.filter((candidate) => openStatuses.has(candidate.status) && Boolean(candidate.waiting_on))
			.sort(
				(a, b) =>
					statusRank(a.status) - statusRank(b.status) || b.last_activity_at - a.last_activity_at
			)
	);
	const currentNextStep = $derived.by(() => {
		if (item.current_next_step_id) {
			const linked = children.find((candidate) => candidate.id === item.current_next_step_id);
			if (linked) return linked;
		}
		return (
			childrenOfType('next_step').filter((candidate) => openStatuses.has(candidate.status))[0] ??
			null
		);
	});
	const automations = $derived(childrenOfType('automation'));
	const findings = $derived(childrenOfType('finding'));
	const projectLevelWork = $derived(
		sortProjectItems(directChildren.filter((candidate) => planWorkTypes.includes(candidate.type)))
	);
	const projectPlanGroups = $derived.by<ProjectPlanGroup[]>(() => {
		const groups: ProjectPlanGroup[] = milestones.map((milestone) => ({
			id: `milestone-${milestone.id}`,
			title: milestone.title,
			description: itemPrimaryText(milestone),
			milestone,
			work: sortProjectItems(
				children.filter(
					(candidate) =>
						candidate.parent_item_id === milestone.id && planWorkTypes.includes(candidate.type)
				)
			)
		}));
		if (projectLevelWork.length || groups.length === 0) {
			groups.push({
				id: 'project-level-work',
				title: 'Project-level work',
				description: groups.length
					? 'Work attached directly to the project instead of a milestone.'
					: 'Work attached to the project before milestone structure exists.',
				milestone: null,
				work: projectLevelWork
			});
		}
		return groups;
	});
	const recentActivity = $derived(
		[...children].sort((a, b) => b.last_activity_at - a.last_activity_at).slice(0, 8)
	);
	const evidenceLabels = $derived(
		findings
			.flatMap((finding) => finding.source_refs ?? [])
			.filter((value, index, source) => value.trim() && source.indexOf(value) === index)
			.slice(0, 5)
	);

	function childrenOfType(type: WorkItemType): WorkItem[] {
		return [...children]
			.filter((candidate) => candidate.type === type)
			.sort(
				(a, b) =>
					statusRank(a.status) - statusRank(b.status) ||
					timelineValue(a) - timelineValue(b) ||
					b.last_activity_at - a.last_activity_at
			);
	}

	function statusRank(status: WorkStatus): number {
		if (status === 'blocked') return 0;
		if (status === 'needs_review') return 1;
		if (status === 'ready') return 2;
		if (status === 'in_progress') return 3;
		if (status === 'waiting') return 4;
		if (status === 'scheduled') return 5;
		if (status === 'planning') return 6;
		if (status === 'backlog') return 7;
		return 8;
	}

	function timelineValue(candidate: WorkItem): number {
		const value =
			candidate.type === 'automation'
				? (candidate.next_run_at ?? candidate.scheduled_at)
				: (candidate.due_date ?? candidate.target_date);
		if (!value) return Number.MAX_SAFE_INTEGER;
		const parsed = typeof value === 'number' ? value * 1000 : new Date(value).valueOf();
		return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
	}

	function firstText(...values: Array<string | number | null | undefined>): string {
		const value = values.find(
			(entry) => entry !== null && entry !== undefined && `${entry}`.trim()
		);
		return value === undefined || value === null ? 'Not set' : `${value}`;
	}

	function routeFor(candidate: WorkItem): `/work/${string}/${string}` {
		return `/work/${pathForType(candidate.type)}/${candidate.id}`;
	}

	function typeLabel(candidate: WorkItem): string {
		return sentenceCase(candidate.type);
	}

	function compactDetail(candidate: WorkItem): string {
		return firstText(
			candidate.next_step_action,
			candidate.question_text,
			candidate.decision_question,
			candidate.change_scope,
			candidate.finding_text,
			candidate.next_action,
			candidate.description,
			candidate.body,
			candidate.title
		);
	}

	function sortProjectItems(source: WorkItem[]): WorkItem[] {
		return [...source].sort(
			(a, b) =>
				statusRank(a.status) - statusRank(b.status) ||
				timelineValue(a) - timelineValue(b) ||
				b.last_activity_at - a.last_activity_at
		);
	}

	function uniqueItems(source: WorkItem[]): WorkItem[] {
		const seen: number[] = [];
		return source.filter((candidate) => {
			if (seen.includes(candidate.id)) return false;
			seen.push(candidate.id);
			return true;
		});
	}

	function isMilestone(candidate: WorkItem): boolean {
		return candidate.type === 'milestone';
	}

	function itemPrimaryText(candidate: WorkItem): string {
		if (candidate.type === 'automation')
			return firstText(
				candidate.last_result,
				candidate.result,
				candidate.description,
				candidate.title
			);
		if (candidate.type === 'milestone')
			return firstText(candidate.milestone_marker, candidate.description, candidate.title);
		return compactDetail(candidate);
	}

	function dateLabel(candidate: WorkItem): string {
		if (candidate.type === 'automation')
			return `Next ${formatDateTime(candidate.next_run_at ?? candidate.scheduled_at)}`;
		if (candidate.due_date) return `Due ${formatDate(candidate.due_date)}`;
		return formatDateTime(candidate.last_activity_at);
	}

	function briefValue(field: keyof WorkItem, fallback: string): string {
		const value = item[field];
		return typeof value === 'string' && value.trim() ? value : fallback;
	}

	function healthLabel(): string {
		return item.health ? sentenceCase(item.health) : health.label;
	}

	function projectScheduleLabel(): string {
		const upcoming = [...children, item]
			.filter((candidate) => timelineValue(candidate) !== Number.MAX_SAFE_INTEGER)
			.sort((a, b) => timelineValue(a) - timelineValue(b))[0];
		if (!upcoming) return 'No date set';
		const prefix = upcoming.id === item.id ? 'Project' : typeLabel(upcoming);
		return `${prefix} · ${dateLabel(upcoming).replace(/^Due /, '')}`;
	}
</script>

<section
	class="overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-1 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
	data-testid="work-detail-page"
>
	<div
		class="grid min-h-[calc(100dvh-7rem)] xl:grid-cols-[14rem_minmax(0,1fr)_19rem]"
		data-testid="project-ledger"
	>
		<aside class="hidden border-r border-outline-variant/55 bg-surface-0/45 p-4 xl:block">
			<p class="text-xs font-semibold uppercase text-on-surface-variant">Project ledger</p>
			<p class="mt-2 text-lg font-semibold text-on-surface">{itemDisplayId(item)}</p>
			<nav class="mt-5 space-y-1" aria-label="Project ledger sections">
				{#each anchors as anchor (anchor.id)}
					<a
						href={`#${anchor.id}`}
						class="falcon-focus flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-2 hover:text-on-surface"
					>
						<span class="font-mono text-xs">{anchor.number}.</span>
						<span>{anchor.label}</span>
					</a>
				{/each}
			</nav>
			<a
				href={resolve('/work/projects')}
				class="falcon-focus mt-6 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-primary transition hover:bg-surface-2"
			>
				<ArrowRight class="h-4 w-4 rotate-180" />
				Projects
			</a>
		</aside>

		<div class="min-w-0">
			<header class="border-b border-outline-variant/55 bg-surface-0/35 px-4 py-4 sm:px-5">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2 text-sm">
							<a
								href={resolve('/work/projects')}
								class="falcon-focus rounded-md text-on-surface-variant transition hover:text-primary"
							>
								Projects
							</a>
							<span class="text-on-surface-variant">/</span>
							<span class="text-on-surface-variant">{itemDisplayId(item)}</span>
						</div>
						<h2 class="mt-2 text-2xl font-semibold leading-tight text-on-surface sm:text-3xl">
							{item.title}
						</h2>
						<p class="mt-2 text-sm text-on-surface-variant">
							Last updated {formatDateTime(item.last_meaningful_update_at ?? item.last_activity_at)}
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<span
							class="rounded-md border border-outline-variant/70 bg-surface-1 px-2.5 py-1 text-xs font-semibold {statusTone(
								item.status
							)}"
						>
							{sentenceCase(formatStatus(item.status))}
						</span>
						<span
							class="rounded-md border border-outline-variant/70 bg-surface-1 px-2.5 py-1 text-xs font-semibold {health.tone}"
						>
							{healthLabel()}
						</span>
					</div>
				</div>
			</header>

			<div class="space-y-8 px-4 py-5 sm:px-5">
				<section id="project-brief" class="scroll-mt-20">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-primary"></span>
						<h3 class="text-sm font-semibold text-on-surface">Operating brief</h3>
					</div>
					<div
						class="divide-y divide-outline-variant/45 rounded-lg border border-outline-variant/55 bg-surface-0/35"
					>
						<div class="grid gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
							<p class="text-sm font-semibold text-on-surface-variant">Goal</p>
							<p class="text-sm leading-6 text-on-surface">
								{briefValue(
									'goal',
									firstText(item.description, item.body, 'No project goal recorded yet.')
								)}
							</p>
						</div>
						<div class="grid gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
							<p class="text-sm font-semibold text-on-surface-variant">Definition of done</p>
							<div class="text-sm leading-6 text-on-surface">
								<MarkdownRenderer
									content={briefValue('definition_of_done', 'No definition of done recorded yet.')}
								/>
							</div>
						</div>
						<div class="grid gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
							<p class="text-sm font-semibold text-on-surface-variant">Why it matters</p>
							<p class="text-sm leading-6 text-on-surface">
								{briefValue('why_it_matters', 'No impact statement recorded yet.')}
							</p>
						</div>
						<div class="grid gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
							<p class="text-sm font-semibold text-on-surface-variant">Scope</p>
							<p class="text-sm leading-6 text-on-surface">
								{briefValue('scope', 'No in-scope boundary recorded yet.')}
							</p>
						</div>
						<div class="grid gap-2 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)]">
							<p class="text-sm font-semibold text-on-surface-variant">Non-scope</p>
							<p class="text-sm leading-6 text-on-surface">
								{briefValue('non_scope', 'No explicit non-scope recorded yet.')}
							</p>
						</div>
					</div>
				</section>

				<section id="project-current-work" class="scroll-mt-20">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-status-warning"></span>
						<h3 class="text-sm font-semibold text-on-surface">Current state</h3>
					</div>
					<div class="overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-0/35">
						<div class="border-b border-outline-variant/45 p-4">
							<p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
								Current next step
							</p>
							{#if currentNextStep}
								<a
									href={resolve(routeFor(currentNextStep))}
									class="falcon-focus mt-2 block rounded-md border border-primary/25 bg-primary-container/10 p-3 transition hover:border-primary/45 hover:bg-primary-container/15"
								>
									<div class="flex flex-wrap items-center justify-between gap-3">
										<p class="text-base font-semibold text-on-surface">{currentNextStep.title}</p>
										<span class="text-xs {statusTone(currentNextStep.status)}">
											{formatStatus(currentNextStep.status)}
										</span>
									</div>
									<p class="mt-2 text-sm leading-6 text-on-surface-variant">
										{itemPrimaryText(currentNextStep)}
									</p>
									<p class="mt-2 text-xs text-on-surface-variant">
										{dateLabel(currentNextStep)}
									</p>
								</a>
							{:else}
								<p class="mt-2 text-sm text-on-surface-variant">No current next step is linked.</p>
							{/if}
						</div>
						<div
							class="grid divide-y divide-outline-variant/45 lg:grid-cols-2 lg:divide-x lg:divide-y-0"
						>
							<div class="p-4">
								<div class="flex items-center justify-between gap-3">
									<h4 class="text-sm font-semibold text-status-danger">Blockers</h4>
									<span
										class="rounded-md border border-status-danger/35 px-2 py-1 text-xs font-semibold text-status-danger"
									>
										{blockers.length} active
									</span>
								</div>
								<div class="mt-3 space-y-2">
									{#each blockers as blocker (blocker.id)}
										<a
											href={resolve(routeFor(blocker))}
											class="block rounded-md border border-status-danger/25 bg-status-danger-bg/35 p-3 transition hover:bg-status-danger-bg/60"
										>
											<p class="text-sm font-semibold text-on-surface">{blocker.title}</p>
											<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
												{compactDetail(blocker)}
											</p>
										</a>
									{:else}
										<p class="text-sm text-on-surface-variant">No active blockers.</p>
									{/each}
								</div>
							</div>
							<div class="p-4">
								<div class="flex items-center justify-between gap-3">
									<h4 class="text-sm font-semibold text-status-warning">Waiting state</h4>
									<span
										class="rounded-md border border-status-warning/35 px-2 py-1 text-xs font-semibold text-status-warning"
									>
										{waitingItems.length} waiting
									</span>
								</div>
								<div class="mt-3 space-y-2">
									{#each waitingItems as waitingItem (waitingItem.id)}
										<a
											href={resolve(routeFor(waitingItem))}
											class="block rounded-md border border-outline-variant/45 bg-surface-1/55 p-3 transition hover:bg-surface-2/70"
										>
											<div class="flex items-center justify-between gap-3">
												<p class="text-sm font-semibold text-on-surface">{waitingItem.title}</p>
												<span class="shrink-0 text-xs text-status-warning">
													{waitingLabel(waitingItem.waiting_on)}
												</span>
											</div>
											<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
												{itemPrimaryText(waitingItem)}
											</p>
										</a>
									{:else}
										<p class="text-sm text-on-surface-variant">Nothing is marked waiting.</p>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</section>

				<section id="project-plan" class="scroll-mt-20" data-testid="project-plan">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-status-info"></span>
						<h3 class="text-sm font-semibold text-on-surface">Project plan</h3>
					</div>
					<div class="space-y-4">
						{#each projectPlanGroups as group (group.id)}
							<div
								class="overflow-hidden rounded-lg border border-outline-variant/55 bg-surface-0/35"
								data-testid="project-plan-group"
							>
								<div
									class="grid gap-3 border-b border-outline-variant/45 bg-surface-1/45 px-4 py-3 md:grid-cols-[minmax(0,1fr)_9rem]"
								>
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											{#if group.milestone}
												<a
													href={resolve(routeFor(group.milestone))}
													class="falcon-focus text-base font-semibold text-on-surface transition hover:text-primary"
												>
													{group.title}
												</a>
												<span class="text-xs {statusTone(group.milestone.status)}">
													{formatStatus(group.milestone.status)}
												</span>
											{:else}
												<p class="text-base font-semibold text-on-surface">{group.title}</p>
											{/if}
										</div>
										<p class="mt-1 text-sm leading-6 text-on-surface-variant">
											{group.description}
										</p>
									</div>
									{#if group.milestone}
										<p class="text-xs font-semibold text-on-surface-variant md:text-right">
											{dateLabel(group.milestone)}
										</p>
									{/if}
								</div>
								<div class="divide-y divide-outline-variant/35">
									{#each group.work as work (work.id)}
										<a
											href={resolve(routeFor(work))}
											class="grid gap-3 px-4 py-3 transition hover:bg-surface-2/55 md:grid-cols-[8rem_minmax(0,1fr)_8rem]"
										>
											<div class="flex flex-wrap items-center gap-2 md:block">
												<p class="text-xs font-semibold text-on-surface-variant">
													{typeLabel(work)}
												</p>
												<p class="mt-0 text-xs {statusTone(work.status)} md:mt-2">
													{formatStatus(work.status)}
												</p>
											</div>
											<div class="min-w-0">
												<p class="text-sm font-semibold text-on-surface">{work.title}</p>
												<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
													{itemPrimaryText(work)}
												</p>
												{#if work.type === 'decision' && work.consequence_of_no_decision}
													<p class="mt-1 text-xs text-status-warning">
														No decision: {work.consequence_of_no_decision}
													</p>
												{/if}
												{#if work.type === 'open_question'}
													<p class="mt-1 text-xs text-on-surface-variant">
														Can answer: {firstText(work.answerer, work.owner, 'Not set')}
													</p>
												{/if}
											</div>
											<p class="text-xs text-on-surface-variant md:text-right">
												{dateLabel(work)}
											</p>
										</a>
									{:else}
										<p class="px-4 py-3 text-sm text-on-surface-variant">
											No work is attached here yet.
										</p>
									{/each}
								</div>
							</div>
						{:else}
							<p
								class="rounded-md border border-outline-variant/45 bg-surface-0/25 p-4 text-sm text-on-surface-variant"
							>
								No project plan has been captured yet.
							</p>
						{/each}
					</div>
				</section>

				<section id="project-signals" class="scroll-mt-20">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-status-active"></span>
						<h3 class="text-sm font-semibold text-on-surface">Automations</h3>
					</div>
					<div class="grid gap-2 md:grid-cols-2">
						{#each automations as automation (automation.id)}
							<a
								href={resolve(routeFor(automation))}
								class="rounded-md border border-outline-variant/45 bg-surface-0/35 p-4 transition hover:bg-surface-2/55"
							>
								<div class="flex items-center justify-between gap-3">
									<p class="text-sm font-semibold text-on-surface">{automation.title}</p>
									<span
										class="text-xs {automation.enabled
											? 'text-status-active'
											: 'text-status-muted'}"
									>
										{automation.enabled ? 'Enabled' : 'Paused'}
									</span>
								</div>
								<p class="mt-2 text-sm text-on-surface-variant">
									{itemPrimaryText(automation)}
								</p>
								<p class="mt-2 text-xs text-on-surface-variant">
									{firstText(automation.trigger_type, 'manual')} · {dateLabel(automation)}
								</p>
							</a>
						{:else}
							<p
								class="rounded-md border border-outline-variant/45 bg-surface-0/25 p-4 text-sm text-on-surface-variant md:col-span-2"
							>
								No automations are attached to this project.
							</p>
						{/each}
					</div>
				</section>

				<section id="project-findings" class="scroll-mt-20">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-on-surface-variant"></span>
						<h3 class="text-sm font-semibold text-on-surface">Findings and evidence</h3>
					</div>
					<div
						class="divide-y divide-outline-variant/35 rounded-lg border border-outline-variant/45 bg-surface-0/35"
					>
						{#each findings as finding (finding.id)}
							<a
								href={resolve(routeFor(finding))}
								class="grid gap-3 px-4 py-3 transition hover:bg-surface-2/55 md:grid-cols-[7rem_minmax(0,1fr)_9rem]"
							>
								<p class="text-xs text-on-surface-variant">{formatDateTime(finding.created_at)}</p>
								<div class="min-w-0">
									<p class="text-sm font-semibold text-on-surface">{finding.title}</p>
									<p class="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
										{itemPrimaryText(finding)}
									</p>
								</div>
								<p class="text-xs text-on-surface-variant md:text-right">
									{firstText(finding.source_refs?.[0], finding.owner, 'Work')}
								</p>
							</a>
						{:else}
							<p class="px-4 py-3 text-sm text-on-surface-variant">
								No findings are attached to this project.
							</p>
						{/each}
					</div>
					{#if evidenceLabels.length}
						<div class="mt-3 flex flex-wrap gap-2">
							{#each evidenceLabels as evidence (evidence)}
								<span
									class="rounded-md border border-outline-variant/50 bg-surface-0/35 px-2 py-1 text-xs font-semibold text-on-surface-variant"
								>
									{evidence}
								</span>
							{/each}
						</div>
					{/if}
				</section>

				<section id="project-activity" class="scroll-mt-20">
					<div class="mb-3 flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-primary"></span>
						<h3 class="text-sm font-semibold text-on-surface">Activity</h3>
					</div>
					<div class="space-y-3 border-l border-outline-variant/55 pl-4">
						{#each recentActivity as activity (activity.id)}
							<a
								href={resolve(routeFor(activity))}
								class="block rounded-md px-3 py-2 transition hover:bg-surface-2/55"
							>
								<div class="flex flex-wrap items-center gap-2 text-xs">
									<span class="text-on-surface-variant">{typeLabel(activity)}</span>
									<span class={statusTone(activity.status)}>{formatStatus(activity.status)}</span>
									<span class="text-on-surface-variant">
										{formatDateTime(activity.last_activity_at)}
									</span>
								</div>
								<p class="mt-1 text-sm font-semibold text-on-surface">{activity.title}</p>
							</a>
						{:else}
							<p class="text-sm text-on-surface-variant">
								No child activity has been recorded yet.
							</p>
						{/each}
					</div>
				</section>
			</div>
		</div>

		<aside class="border-t border-outline-variant/55 bg-surface-0/45 p-4 xl:border-l xl:border-t-0">
			<div class="space-y-5 xl:sticky xl:top-16">
				<section>
					<h3 class="text-sm font-semibold text-on-surface-variant">Health and status</h3>
					<div class="mt-3 space-y-3 text-sm">
						<div class="flex items-center justify-between gap-3">
							<span class="text-on-surface-variant">Overall health</span>
							<span class="font-semibold {health.tone}">{healthLabel()}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span class="text-on-surface-variant">Schedule</span>
							<span class="text-right font-semibold text-on-surface">{projectScheduleLabel()}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span class="text-on-surface-variant">Priority</span>
							<span class="font-semibold {priorityTone(item.priority)}">
								{sentenceCase(item.priority ?? 'normal')}
							</span>
						</div>
					</div>
				</section>

				<section class="border-t border-outline-variant/45 pt-4">
					<h3 class="text-sm font-semibold text-on-surface-variant">Key dates</h3>
					<div class="mt-3 space-y-3 text-sm">
						<div>
							<p class="text-xs text-on-surface-variant">Started</p>
							<p class="mt-1 font-semibold text-on-surface">{formatDate(item.start_date)}</p>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Target completion</p>
							<p class="mt-1 font-semibold text-on-surface">
								{formatDate(item.target_date ?? item.due_date)}
							</p>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Last meaningful update</p>
							<p class="mt-1 font-semibold text-on-surface">
								{formatDateTime(item.last_meaningful_update_at ?? item.last_activity_at)}
							</p>
						</div>
					</div>
				</section>

				<section class="border-t border-outline-variant/45 pt-4">
					<h3 class="text-sm font-semibold text-on-surface-variant">Ownership</h3>
					<div class="mt-3 space-y-3 text-sm">
						<div>
							<p class="text-xs text-on-surface-variant">Operator</p>
							<p class="mt-1 font-semibold text-on-surface">
								{firstText(item.operator, item.owner, 'Not set')}
							</p>
						</div>
						<div>
							<p class="text-xs text-on-surface-variant">Category</p>
							<p class="mt-1 font-semibold text-on-surface">
								{firstText(item.subcategory_id, item.category_id, 'Not set')}
							</p>
						</div>
					</div>
				</section>

				{#if healthReasons.length}
					<section class="border-t border-outline-variant/45 pt-4">
						<h3 class="text-sm font-semibold text-on-surface">Health reasons</h3>
						<div class="mt-3 space-y-2">
							{#each healthReasons as reason (reason.key)}
								<div class="rounded-md border border-outline-variant/40 bg-surface-1/55 p-3">
									<p class="text-sm font-semibold {reason.tone}">{reason.label}</p>
									<p class="mt-1 text-xs leading-5 text-on-surface-variant">{reason.detail}</p>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<form class="space-y-3 border-t border-outline-variant/45 pt-4" onsubmit={onSave}>
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-sm font-semibold text-on-surface">State controls</h3>
						{#if saveMessage}<span class="text-xs text-status-active">{saveMessage}</span>{/if}
					</div>
					<label class="grid gap-1 text-xs text-on-surface-variant">
						Status
						<select
							bind:value={draft.status}
							class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
						>
							{#each workStatuses as status (status)}
								<option value={status}>{sentenceCase(formatStatus(status))}</option>
							{/each}
						</select>
					</label>
					<div class="grid grid-cols-2 gap-2">
						<label class="grid gap-1 text-xs text-on-surface-variant">
							Priority
							<select
								bind:value={draft.priority}
								class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
							>
								<option value="low">Low</option>
								<option value="normal">Normal</option>
								<option value="high">High</option>
								<option value="urgent">Urgent</option>
							</select>
						</label>
						<label class="grid gap-1 text-xs text-on-surface-variant">
							Waiting on
							<select
								bind:value={draft.waiting_on}
								class="falcon-focus min-h-9 rounded-md border border-outline-variant/70 bg-surface-0 px-2 text-sm text-on-surface"
							>
								{#each waitingOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</label>
					</div>
					<button
						type="submit"
						disabled={saving}
						class="falcon-focus inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
					>
						<Save class="h-4 w-4" />
						{saving ? 'Saving...' : 'Save state'}
					</button>
					{#if error}<p class="text-sm text-status-danger">{error}</p>{/if}
				</form>
			</div>
		</aside>
	</div>
</section>
