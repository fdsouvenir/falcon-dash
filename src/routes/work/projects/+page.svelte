<script lang="ts">
	import { resolve } from '$app/paths';
	import { EmptyState, FocusChips } from '$lib/components/work/index.js';
	import { filterByFocus } from '$lib/work3/focus.js';
	import type { PageData } from './$types.js';

	interface CurrentNext {
		id: string;
		title: string;
		type: string;
		status: string;
	}

	interface ProjectListItem {
		id: string;
		title: string;
		summary?: string | null;
		portfolio_summary?: string | null;
		status: string;
		health: string;
		progress: {
			criteria: string;
			milestones: string;
			work_open: number;
			work_blocked: number;
		};
		current_next?: CurrentNext | null;
		current_next_valid: boolean;
		target_at?: number | null;
		updated_at: number;
		archived: boolean;
	}

	let { data }: { data: PageData } = $props();

	const projects = $derived(data.projects as unknown as ProjectListItem[]);
	const statusFiltered = $derived(
		data.status ? projects.filter((project) => project.status === data.status) : projects
	);
	const filteredProjects = $derived.by(() => {
		const focused = filterByFocus(
			statusFiltered as unknown as Array<Record<string, unknown>>,
			'project',
			data.focus,
			data.now
		) as unknown as ProjectListItem[];
		return [...focused].sort(compareProjects);
	});
	const openProjects = $derived(
		projects.filter(
			(project) =>
				!project.archived && ['draft', 'planned', 'active', 'paused'].includes(project.status)
		)
	);

	const lifecycleOptions = [
		{ value: '', label: 'All lifecycles' },
		{ value: 'active', label: 'Active' },
		{ value: 'planned', label: 'Planned' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'paused', label: 'Paused' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	];

	function attentionRank(project: ProjectListItem): number {
		if (project.archived) return 9;
		if (project.health === 'blocked') return 0;
		if (project.health === 'at_risk') return 1;
		if (project.status === 'active' && !project.current_next_valid) return 2;
		return (
			{
				active: 3,
				paused: 4,
				planned: 5,
				draft: 6,
				completed: 7,
				cancelled: 8
			}[project.status] ?? 8
		);
	}

	function compareProjects(left: ProjectListItem, right: ProjectListItem): number {
		const rank = attentionRank(left) - attentionRank(right);
		if (rank !== 0) return rank;
		if (left.target_at && right.target_at) return left.target_at - right.target_at;
		if (left.target_at) return -1;
		if (right.target_at) return 1;
		return right.updated_at - left.updated_at;
	}

	function lifecycleLabel(value: string): string {
		return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
	}

	function lifecycleTone(value: string): string {
		if (value === 'active') return 'text-status-active';
		if (value === 'paused') return 'text-status-warning';
		if (value === 'completed') return 'text-status-info';
		if (value === 'cancelled') return 'text-status-danger';
		return 'text-on-surface-variant';
	}

	function attentionLabel(project: ProjectListItem): string {
		if (project.archived) return 'Archived';
		if (project.health === 'blocked') {
			return project.current_next?.title
				? `Blocked — ${project.current_next.title}`
				: 'Blocked work needs attention';
		}
		if (project.health === 'at_risk') {
			if (project.target_at && project.target_at < data.now) return 'Past its target date';
			if (project.progress.work_blocked > 0) {
				return `${project.progress.work_blocked} blocked item${project.progress.work_blocked === 1 ? '' : 's'}`;
			}
			return 'Needs attention';
		}
		if (project.status === 'active' && !project.current_next_valid) return 'Needs a next move';
		if (project.status === 'active') return 'No action needed';
		if (project.status === 'planned') return 'Ready to start';
		if (project.status === 'draft') return 'Still being defined';
		if (project.status === 'paused') return 'No work is moving';
		if (project.status === 'completed') return 'Finished';
		return lifecycleLabel(project.status);
	}

	function attentionTone(project: ProjectListItem): string {
		return project.health === 'blocked' ||
			project.health === 'at_risk' ||
			(project.status === 'active' && !project.current_next_valid)
			? 'text-primary'
			: 'text-on-surface-variant';
	}

	function progressLabel(project: ProjectListItem): string {
		const parts: string[] = [];
		const [, criteriaTotal = '0'] = project.progress.criteria.split('/');
		const [, milestoneTotal = '0'] = project.progress.milestones.split('/');
		if (Number(criteriaTotal) > 0) parts.push(`${project.progress.criteria} criteria`);
		if (Number(milestoneTotal) > 0) parts.push(`${project.progress.milestones} milestones`);
		if (project.progress.work_open > 0) parts.push(`${project.progress.work_open} open`);
		return parts.join(' · ');
	}

	function dateLabel(value: number): string {
		return new Date(value).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year:
				new Date(value).getFullYear() === new Date(data.now).getFullYear() ? undefined : 'numeric'
		});
	}
</script>

<svelte:head><title>Projects — Work</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-3">
	<h1 class="sr-only">Projects</h1>

	<section
		class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container px-3 py-3"
		aria-label="Project filters"
	>
		<div class="flex flex-wrap items-center gap-3">
			<div class="mr-auto flex items-baseline gap-2 whitespace-nowrap">
				<strong class="font-mono text-[length:var(--text-body)] text-on-surface"
					>{openProjects.length} open</strong
				>
				<span class="text-[length:var(--text-label)] text-on-surface-variant"
					>{projects.length} total</span
				>
			</div>

			<form method="GET" class="flex items-center gap-2">
				{#if data.focus}<input type="hidden" name="focus" value={data.focus} />{/if}
				<label for="project-lifecycle" class="sr-only">Project lifecycle</label>
				<select
					id="project-lifecycle"
					name="status"
					value={data.status ?? ''}
					onchange={(event) => event.currentTarget.form?.requestSubmit()}
					class="falcon-focus touch-target rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container-high px-3 text-[length:var(--text-label)] font-semibold text-on-surface"
				>
					{#each lifecycleOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</form>

			<FocusChips
				type="project"
				items={projects as unknown as Array<Record<string, unknown>>}
				active={data.focus}
				now={data.now}
			/>
		</div>
	</section>

	<section
		class="overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
		aria-labelledby="project-list-heading"
	>
		<h2 id="project-list-heading" class="sr-only">
			{data.focus || data.status ? 'Filtered projects' : 'All projects'}
		</h2>
		{#if filteredProjects.length === 0}
			<div class="p-5">
				<EmptyState
					title="No projects here"
					description="Try a different lifecycle or attention filter."
				/>
			</div>
		{:else}
			<div
				class="hidden grid-cols-[4.5rem_minmax(0,1.45fr)_minmax(9rem,0.7fr)_minmax(11rem,0.9fr)_minmax(9rem,auto)] gap-3 border-b border-outline-variant/70 px-4 py-2 font-mono text-[length:var(--text-label)] uppercase tracking-[0.08em] text-on-surface-variant md:grid"
				aria-hidden="true"
			>
				<span>ID</span>
				<span>Project</span>
				<span>Lifecycle</span>
				<span>Attention / next</span>
				<span class="text-right">Progress / target</span>
			</div>
			<div class="divide-y divide-outline-variant/60">
				{#each filteredProjects as project (project.id)}
					<a
						href={resolve('/work/projects/[id]', { id: project.id })}
						class="falcon-focus group grid gap-2 px-4 py-3 hover:bg-surface-container-high md:grid-cols-[4.5rem_minmax(0,1.45fr)_minmax(9rem,0.7fr)_minmax(11rem,0.9fr)_minmax(9rem,auto)] md:items-center md:gap-3"
					>
						<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
							{project.id}
						</span>
						<div class="min-w-0">
							<h3 class="truncate font-semibold text-on-surface group-hover:text-primary">
								{project.title}
							</h3>
							{#if project.portfolio_summary}
								<p class="mt-0.5 truncate text-[length:var(--text-label)] text-on-surface-variant">
									{project.portfolio_summary}
								</p>
							{/if}
						</div>
						<p
							class="text-[length:var(--text-label)] font-semibold {lifecycleTone(project.status)}"
						>
							{lifecycleLabel(project.status)}
						</p>
						<div class="min-w-0">
							<p
								class="truncate text-[length:var(--text-label)] font-medium {attentionTone(
									project
								)}"
							>
								{attentionLabel(project)}
							</p>
							{#if project.current_next_valid && project.current_next}
								<p class="mt-0.5 truncate text-[length:var(--text-label)] text-on-surface-variant">
									Next: {project.current_next.title}
								</p>
							{/if}
						</div>
						<div class="min-w-0 md:text-right">
							{#if progressLabel(project)}
								<p class="truncate font-mono text-[length:var(--text-label)] text-on-surface">
									{progressLabel(project)}
								</p>
							{/if}
							{#if project.target_at}
								<p class="mt-0.5 text-[length:var(--text-label)] text-on-surface-variant">
									Target {dateLabel(project.target_at)}
								</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>
