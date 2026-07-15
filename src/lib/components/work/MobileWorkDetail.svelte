<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		configForType,
		formatDate,
		formatDateTime,
		formatStatus,
		itemDisplayId,
		openStatuses,
		pathForType,
		sentenceCase,
		statusTone,
		waitingLabel,
		type WorkItem,
		type WorkReconciliationRun
	} from '$lib/work/work-ui.js';
	import {
		ArrowLeft,
		Check,
		ChevronDown,
		MessageSquare,
		RefreshCw,
		Send,
		Sparkles
	} from '@lucide/svelte';

	type NextStep = {
		key: string;
		title: string;
		detail: string;
		href: string | null;
		done: boolean;
		meta: string;
	};

	let {
		item,
		parent = null,
		relatedItems = [],
		blockers = [],
		runs = [],
		statusMessage = null,
		loading = false,
		backHref,
		onMessage,
		onRun,
		onAsk
	}: {
		item: WorkItem;
		parent?: WorkItem | null;
		relatedItems?: WorkItem[];
		blockers?: WorkItem[];
		runs?: WorkReconciliationRun[];
		statusMessage?: string | null;
		loading?: boolean;
		backHref: string;
		onMessage?: (message: string) => void;
		onRun?: () => void;
		onAsk?: () => void;
	} = $props();

	let composerText = $state('');

	const config = $derived(configForType(item.type));
	const latestRun = $derived(runs[0] ?? null);
	const hasOpenBlockers = $derived(blockers.some((blocker) => openStatuses.has(blocker.status)));
	const quietMeta = $derived(
		[
			itemDisplayId(item),
			sentenceCase(formatStatus(item.status)),
			sentenceCase(item.priority ?? 'normal')
		].join(' - ')
	);
	const agentNote = $derived.by(() => {
		const explicitMove = firstText(
			item.next_action,
			item.task_action,
			item.proposed_answer,
			item.recommended_option,
			item.generated_work_policy
		);
		if (explicitMove) return explicitMove;
		if (hasOpenBlockers) return `Waiting on ${waitingLabel(item.waiting_on)} before this can move.`;
		if (item.result?.trim()) return item.result.trim();
		return 'Ask the agent to refresh the next move for this work.';
	});
	const nextSteps = $derived.by(() => buildNextSteps(item, relatedItems));
	const activityRows = $derived.by(() => buildActivityRows(item, latestRun, blockers));

	function routeFor(value: WorkItem): string {
		return resolve(`/work/${pathForType(value.type)}/${value.id}`);
	}

	function firstText(...values: Array<string | null | undefined>): string {
		for (const value of values) {
			const trimmed = value?.trim();
			if (trimmed) return trimmed;
		}
		return '';
	}

	function compactText(value: string, max = 180): string {
		const normalized = value.replace(/\s+/g, ' ').trim();
		if (normalized.length <= max) return normalized;
		return `${normalized.slice(0, max - 3).trim()}...`;
	}

	function detailLead(value: WorkItem): string {
		if (value.type === 'project')
			return firstText(
				value.goal,
				value.description,
				value.body,
				'No outcome narrative recorded yet.'
			);
		if (value.type === 'milestone')
			return firstText(
				value.milestone_marker,
				value.description,
				'No milestone marker recorded yet.'
			);
		if (value.type === 'change_request')
			return firstText(
				value.change_scope,
				value.description,
				value.body,
				'No change scope recorded yet.'
			);
		if (value.type === 'decision')
			return firstText(
				value.decision_question,
				value.consequence_of_no_decision,
				value.body,
				value.description,
				'No decision context recorded yet.'
			);
		if (value.type === 'open_question')
			return firstText(
				value.question_text,
				value.why_it_matters,
				value.description,
				'No question context recorded yet.'
			);
		if (value.type === 'task')
			return firstText(
				value.task_action,
				value.next_action,
				value.description,
				'No action recorded yet.'
			);
		if (value.type === 'automation')
			return firstText(
				value.generated_work_policy,
				value.description,
				value.body,
				'No automation policy recorded yet.'
			);
		if (value.type === 'finding')
			return firstText(
				value.finding_text,
				value.description,
				value.body,
				'No finding recorded yet.'
			);
		return firstText(value.next_action, value.description, value.body, value.title);
	}

	function itemSchedule(value: WorkItem): string {
		const date =
			value.due_date ??
			value.target_date ??
			value.scheduled_at ??
			value.next_run_at ??
			value.stale_after;
		return date ? formatDate(date) : 'No date set';
	}

	function buildNextSteps(value: WorkItem, related: WorkItem[]): NextStep[] {
		const steps: NextStep[] = [];
		const seen: string[] = [];

		function add(step: NextStep) {
			if (seen.includes(step.key)) return;
			seen.push(step.key);
			steps.push(step);
		}

		const currentAction = firstText(
			value.next_action,
			value.task_action,
			value.proposed_answer,
			value.recommended_option,
			value.generated_work_policy,
			value.result
		);
		if (currentAction) {
			add({
				key: `item-${value.id}`,
				title: compactText(currentAction, 120),
				detail: `${sentenceCase(formatStatus(value.status))} - ${itemSchedule(value)}`,
				href: null,
				done: !openStatuses.has(value.status),
				meta: 'Current work'
			});
		}

		for (const candidate of related
			.filter((candidate) => openStatuses.has(candidate.status))
			.slice(0, 4)) {
			add({
				key: `related-${candidate.id}`,
				title: candidate.title,
				detail: compactText(
					firstText(candidate.next_action, candidate.description, candidate.body),
					140
				),
				href: routeFor(candidate),
				done: false,
				meta: configForType(candidate.type).singular
			});
		}

		if (!steps.length) {
			add({
				key: 'agent-refresh',
				title: 'Refresh the next real move',
				detail: compactText(detailLead(value), 140),
				href: null,
				done: false,
				meta: 'Agent'
			});
		}

		return steps.slice(0, 5);
	}

	function buildActivityRows(
		value: WorkItem,
		run: WorkReconciliationRun | null,
		openBlockers: WorkItem[]
	): Array<{ key: string; title: string; detail: string; tone: string }> {
		const rows = [
			{
				key: 'updated',
				title: 'Updated',
				detail: formatDateTime(value.last_activity_at || value.updated_at),
				tone: 'bg-primary'
			}
		];

		if (run) {
			rows.push({
				key: `run-${run.id}`,
				title: `Integrity ${formatStatus(run.status)}`,
				detail: run.session_key
					? `Agent session ${run.session_key}`
					: `${run.deterministic_changes?.length ?? 0} mechanical changes`,
				tone: run.status === 'failed' ? 'bg-status-danger' : 'bg-status-info'
			});
		}

		for (const blocker of openBlockers
			.filter((blocker) => openStatuses.has(blocker.status))
			.slice(0, 2)) {
			rows.push({
				key: `blocker-${blocker.id}`,
				title: 'Waiting',
				detail: blocker.title,
				tone: 'bg-status-warning'
			});
		}

		return rows;
	}

	function sendAgentMessage() {
		const value = composerText.trim();
		if (value) onMessage?.(value);
		onAsk?.();
		composerText = '';
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- href values are resolved before render. -->
<section
	class="relative -mx-4 -mt-4 flex min-h-full flex-col bg-background text-on-surface sm:-mx-6 sm:-mt-6"
	data-testid="work-detail-page"
	data-mobile-work-detail="true"
>
	<div class="border-b border-outline-variant/55 bg-surface-container-lowest px-4 py-2">
		<a
			href={backHref}
			class="falcon-focus touch-target-inline -ml-2 inline-flex items-center gap-2 rounded-full px-2 text-sm font-semibold text-primary"
		>
			<ArrowLeft class="h-4 w-4" />
			{config.label}
		</a>
	</div>

	<div class="flex-1 space-y-6 px-4 pb-32 pt-4">
		<header class="space-y-3" data-testid="mobile-work-detail-header">
			<p class="text-sm leading-6 text-on-surface-variant">{quietMeta}</p>
			<h1
				class="text-[length:var(--md-sys-typescale-headline-large-size)] font-semibold leading-[var(--md-sys-typescale-headline-large-line-height)] text-on-surface"
			>
				{item.title}
			</h1>
			{#if parent}
				<a
					href={routeFor(parent)}
					class="falcon-focus touch-target-inline inline-flex max-w-full items-center rounded-full bg-surface-container px-3 py-1.5 text-sm text-on-surface-variant"
				>
					<span class="truncate">{configForType(parent.type).singular}: {parent.title}</span>
				</a>
			{/if}
		</header>

		<section
			class="flex gap-3 border-y border-outline-variant/45 bg-surface-container-low/60 px-1 py-3"
			data-testid="mobile-work-agent-note"
		>
			<div
				class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary"
			>
				<Sparkles class="h-4 w-4" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold text-on-surface">Agent note</p>
				<p class="mt-1 text-sm leading-6 text-on-surface-variant">{compactText(agentNote, 220)}</p>
				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="falcon-focus touch-target-inline inline-flex items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
						disabled={loading}
						onclick={onAsk}
					>
						<MessageSquare class="h-4 w-4" />
						Resolve
					</button>
					<button
						type="button"
						class="falcon-focus touch-target-inline inline-flex items-center gap-2 rounded-full border border-outline-variant/70 px-4 text-sm font-semibold text-on-surface"
						disabled={loading}
						onclick={onRun}
					>
						<RefreshCw class="h-4 w-4" />
						Check
					</button>
				</div>
				{#if statusMessage}
					<p class="mt-2 text-xs text-status-info">{statusMessage}</p>
				{/if}
			</div>
		</section>

		<section data-testid="mobile-work-next-steps">
			<div class="mb-2 flex items-center justify-between gap-3">
				<h2 class="text-sm font-semibold text-on-surface">Next steps</h2>
				<span class="text-sm text-on-surface-variant"
					>{nextSteps.length ? 'Live work' : '0 results'}</span
				>
			</div>
			<div class="divide-y divide-outline-variant/35 border-y border-outline-variant/45">
				{#each nextSteps as step (step.key)}
					<svelte:element
						this={step.href ? 'a' : 'div'}
						href={step.href ?? undefined}
						class="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3"
					>
						<div
							class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border {step.done
								? 'border-status-active bg-status-active text-background'
								: 'border-outline text-transparent'}"
						>
							<Check class="h-3.5 w-3.5" />
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-2 text-xs text-on-surface-variant">
								<span>{step.meta}</span>
								<span>-</span>
								<span>{step.detail || 'No detail recorded'}</span>
							</div>
							<p class="mt-1 text-sm font-semibold leading-6 text-on-surface">{step.title}</p>
						</div>
					</svelte:element>
				{/each}
			</div>
		</section>

		<details
			class="group border-y border-outline-variant/45 py-3"
			data-testid="mobile-work-project-details"
		>
			<summary
				class="falcon-focus flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1"
			>
				<div>
					<h2 class="text-sm font-semibold text-on-surface">Work details</h2>
					<p class="mt-1 text-sm text-on-surface-variant">
						{waitingLabel(item.waiting_on)} - {itemSchedule(item)}
					</p>
				</div>
				<ChevronDown class="h-4 w-4 text-on-surface-variant transition group-open:rotate-180" />
			</summary>
			<div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
				<div>
					<p class="text-on-surface-variant">Status</p>
					<p class="mt-1 font-semibold {statusTone(item.status)}">
						{sentenceCase(formatStatus(item.status))}
					</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Priority</p>
					<p class="mt-1 font-semibold text-on-surface">
						{sentenceCase(item.priority ?? 'normal')}
					</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Waiting</p>
					<p class="mt-1 font-semibold text-on-surface">{waitingLabel(item.waiting_on)}</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Category</p>
					<p class="mt-1 font-semibold text-on-surface">{item.area_id ?? 'Personal / General'}</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Schedule</p>
					<p class="mt-1 font-semibold text-on-surface">{itemSchedule(item)}</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Last update</p>
					<p class="mt-1 font-semibold text-on-surface">
						{formatDateTime(item.last_activity_at || item.updated_at)}
					</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Operator</p>
					<p class="mt-1 font-semibold text-on-surface">{item.owner ?? 'Not set'}</p>
				</div>
				<div>
					<p class="text-on-surface-variant">Health</p>
					<p class="mt-1 font-semibold text-on-surface">
						{hasOpenBlockers ? 'Waiting on related work' : 'No active blockers'}
					</p>
				</div>
			</div>
		</details>

		<section data-testid="mobile-work-brief">
			<h2 class="text-sm font-semibold text-on-surface">Brief</h2>
			<p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
				{compactText(detailLead(item), 700)}
			</p>
		</section>

		<section data-testid="mobile-work-activity">
			<h2 class="text-sm font-semibold text-on-surface">Activity</h2>
			<div class="mt-3 space-y-3">
				{#each activityRows as row (row.key)}
					<div class="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3">
						<span class="mt-2 h-2 w-2 rounded-full {row.tone}"></span>
						<div>
							<p class="text-sm font-semibold text-on-surface">{row.title}</p>
							<p class="mt-1 text-sm leading-6 text-on-surface-variant">{row.detail}</p>
						</div>
					</div>
				{:else}
					<p class="text-sm text-on-surface-variant">0 results</p>
				{/each}
			</div>
		</section>
	</div>

	<form
		class="sticky bottom-2 border-t border-outline-variant/55 bg-surface-container-lowest px-4 py-3 pb-[calc(var(--safe-bottom)+0.75rem)]"
		data-testid="mobile-work-agent-composer"
		onsubmit={(event) => {
			event.preventDefault();
			sendAgentMessage();
		}}
	>
		<label class="sr-only" for="mobile-work-agent-message">Message agent</label>
		<div
			class="flex items-end gap-2 rounded-[1.5rem] border border-outline-variant/70 bg-surface-container px-3 py-2"
		>
			<textarea
				id="mobile-work-agent-message"
				bind:value={composerText}
				rows="1"
				placeholder="Ask the agent to update this work..."
				class="min-h-9 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-on-surface outline-none placeholder:text-on-surface-variant"
			></textarea>
			<button
				type="submit"
				class="falcon-focus touch-target-inline flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
				disabled={loading}
				aria-label="Send to agent"
			>
				<Send class="h-4 w-4" />
			</button>
		</div>
	</form>
</section>
