<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		EmptyState,
		FocusChips,
		PageHeader,
		Section,
		StatTile,
		StatusBadge
	} from '$lib/components/work/index.js';
	import { filterByFocus, focusCounts } from '$lib/work3/focus.js';
	import type { PageData } from './$types.js';

	interface ProjectListItem {
		id: string;
		title: string;
		status: string;
		health: string;
		health_reason?: string;
		progress: {
			criteria: string;
			milestones: string;
			work_open: number;
			work_blocked: number;
		};
		current_next_item_id?: string | null;
		current_next_valid: boolean;
		target_at?: number | null;
		updated_at: number;
		archived: boolean;
	}

	let { data }: { data: PageData } = $props();

	const projects = $derived(data.projects as unknown as ProjectListItem[]);
	const filteredProjects = $derived(
		filterByFocus(
			projects as unknown as Array<Record<string, unknown>>,
			'project',
			data.focus,
			data.now
		) as unknown as ProjectListItem[]
	);
	const counts = $derived(
		focusCounts(projects as unknown as Array<Record<string, unknown>>, 'project', data.now)
	);
	const openProjects = $derived(
		projects.filter(
			(project) =>
				!project.archived && ['draft', 'planned', 'active', 'paused'].includes(project.status)
		)
	);
	const healthDistribution = $derived(
		['on_track', 'at_risk', 'blocked', 'unknown'].map((health) => ({
			health,
			count: openProjects.filter((project) => project.health === health).length
		}))
	);

	function focusHref(focus?: string): string {
		return focus ? resolve(`/work/projects?focus=${focus}`) : resolve('/work/projects');
	}

	function dateLabel(value?: number | null): string {
		if (!value) return 'No target';
		return new Date(value).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head><title>Projects — Work</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-5">
	<PageHeader
		eyebrow="Portfolio"
		title="Projects"
		description="Outcome health, target pressure, and the next moves across active Projects."
	/>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		<StatTile
			label="Open Projects"
			value={openProjects.length}
			description="Draft, planned, active, or paused outcomes."
			href={focusHref()}
			tone="info"
		/>
		<StatTile
			label="Blocked"
			value={counts.blocked ?? 0}
			description="Server-derived health is blocked."
			href={focusHref('blocked')}
			tone="danger"
		/>
		<StatTile
			label="At risk"
			value={counts['at-risk'] ?? 0}
			description="Health signals need operator attention."
			href={focusHref('at-risk')}
			tone="warning"
		/>
		<StatTile
			label="Overdue"
			value={counts.overdue ?? 0}
			description="The Project target date has passed."
			href={focusHref('overdue')}
			tone="danger"
		/>
		<StatTile
			label="No next move"
			value={counts['no-next-move'] ?? 0}
			description="No valid current-next item is set."
			href={focusHref('no-next-move')}
			tone="warning"
		/>
		<StatTile
			label="Stale"
			value={counts.stale ?? 0}
			description="No Project update in 14 days."
			href={focusHref('stale')}
			tone="muted"
		/>
	</div>

	<Section
		title="Portfolio health"
		description="Distribution uses the health derived by the Project reader."
	>
		<div class="grid gap-2 sm:grid-cols-4">
			{#each healthDistribution as segment (segment.health)}
				<div
					class="flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] bg-surface-container-high px-3 py-3"
				>
					<StatusBadge
						type="project_health"
						value={segment.health}
						label={segment.health.replaceAll('_', ' ')}
					/>
					<span class="font-mono text-lg font-semibold text-on-surface">{segment.count}</span>
				</div>
			{/each}
		</div>
	</Section>

	<FocusChips
		type="project"
		items={projects as unknown as Array<Record<string, unknown>>}
		active={data.focus}
		now={data.now}
	/>

	<Section
		title={data.focus ? 'Focused Projects' : 'Project portfolio'}
		description={data.focus
			? `${filteredProjects.length} Projects match the selected focus.`
			: `${projects.length} Projects in the current portfolio view.`}
	>
		{#if filteredProjects.length === 0}
			<EmptyState
				title="No Projects match"
				description="This focus currently has a definitive empty result."
			/>
		{:else}
			<div class="divide-y divide-outline-variant/60">
				{#each filteredProjects as project (project.id)}
					<a
						href={resolve('/work/projects/[id]', { id: project.id })}
						class="falcon-focus touch-target grid gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-2 py-4 hover:bg-surface-container-high md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="break-words font-semibold text-on-surface">{project.title}</h2>
								<StatusBadge type="project" value={project.status} />
								<StatusBadge type="project_health" value={project.health} />
							</div>
							<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
								{project.health_reason ?? 'Health reason unavailable'}
							</p>
							<p class="mt-2 text-[length:var(--text-label)] text-on-surface-variant">
								Criteria {project.progress.criteria} · Milestones {project.progress.milestones} ·
								{project.progress.work_open} open · {project.progress.work_blocked} blocked
							</p>
						</div>
						<div class="text-left md:text-right">
							<p class="font-medium text-on-surface">{dateLabel(project.target_at)}</p>
							<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
								{project.current_next_valid
									? `Next: ${project.current_next_item_id}`
									: 'No valid current next'}
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</Section>
</div>
