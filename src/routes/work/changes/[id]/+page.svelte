<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		CommandBar,
		CommandFeedback,
		DataRow,
		PageHeader,
		Section,
		StatTile,
		StatusBadge,
		Timeline
	} from '$lib/components/work/index.js';
	import type { ActionData, PageData } from './$types.js';

	interface AuthorityBasis {
		kind?: string;
		source_ref?: { label?: string; ref?: string };
	}

	interface ChangeDetail {
		id: string;
		title: string;
		summary?: string | null;
		version: number;
		execution_state: string;
		verification_state: string;
		authorization?: { state?: string; reason?: string; id?: string } | null;
		next_action?: string | null;
		revision_id?: string | null;
		scope_allowed?: string[];
		scope_prohibited?: string[];
		targets?: unknown;
		risk?: unknown;
		safety?: unknown;
		acceptance_criteria?: Array<{ id: string; text: string }>;
		criteria_status?: Record<string, { state?: string; reason?: string }>;
		plan_id?: string | null;
		plan_revision?: number | null;
		plan_review_disposition?: string | null;
		result_summary?: string | null;
		failure_summary?: string | null;
		verification_waived_reason?: string | null;
		cancel_reason?: string | null;
		rollback_started_at?: number | null;
		area_id?: string | null;
		updated_at?: number | null;
		reviews?: Array<{
			id: string;
			outcome?: string;
			summary?: string;
			reviewer?: string;
			subject_revision?: string;
			submitted_at?: number;
		}>;
		authorizations?: Array<{
			id: string;
			effectiveness?: string;
			effectiveness_reason?: string;
			authorizer?: string;
			authority_basis?: AuthorityBasis;
			subject_revision?: string;
			plan_revision?: string;
			scope_fingerprint?: string;
			conditions?: unknown;
			one_time?: boolean;
			granted_at?: number;
			expires_at?: number | null;
			revoked_at?: number;
			revoke_reason?: string;
			consumed_at?: number;
		}>;
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

	interface PlanDetail {
		id: string;
		title?: string;
		revision?: number;
		revision_id?: string;
		state?: string;
		review_disposition?: string;
		summary?: string;
		steps?: Array<{ step?: string; expected_output?: string }>;
		assumptions?: unknown;
		risks?: unknown;
		out_of_scope?: unknown;
		validation_checks?: unknown;
		revisions?: Array<{
			id?: string;
			revision?: number;
			revision_id?: string;
			state?: string;
			review_disposition?: string;
			supersedes?: string | null;
			created_at?: number;
		}>;
	}

	interface CommandAvailability {
		command: string;
		enabled?: boolean;
		reason?: string;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const change = $derived(data.change as unknown as ChangeDetail);
	const plan = $derived(data.plan as unknown as PlanDetail | null);
	const authorizationState = $derived(change.authorization?.state ?? 'missing');
	const authorized = $derived(authorizationState === 'valid');

	const executionCommands = $derived.by<CommandAvailability[]>(() => {
		const guarded = (command: string, verb: string): CommandAvailability => ({
			command,
			enabled: authorized,
			reason: authorized ? undefined : `${verb} unavailable — Authorization ${authorizationState}`
		});
		switch (change.execution_state) {
			case 'not_started':
				return [guarded('start_change', 'Start'), { command: 'cancel_change' }];
			case 'in_progress':
				return [
					guarded('succeed_execution', 'Complete'),
					{ command: 'fail_execution' },
					{ command: 'pause_change' },
					{ command: 'cancel_change' }
				];
			case 'paused':
				return [guarded('resume_change', 'Resume'), { command: 'cancel_change' }];
			case 'failed':
				return [
					guarded('retry_change', 'Retry'),
					{ command: 'start_rollback' },
					{ command: 'cancel_change' }
				];
			case 'succeeded':
				return [{ command: 'start_rollback' }];
			default:
				return [];
		}
	});

	const verificationCommands = $derived.by<CommandAvailability[]>(() => {
		if (change.execution_state !== 'succeeded' && change.verification_state === 'not_started') {
			return [];
		}
		switch (change.verification_state) {
			case 'not_started':
				return [{ command: 'start_verification' }, { command: 'waive_verification' }];
			case 'in_progress':
				return [
					{ command: 'pass_verification' },
					{ command: 'fail_verification' },
					{ command: 'waive_verification' }
				];
			case 'failed':
				return [{ command: 'start_verification' }, { command: 'waive_verification' }];
			default:
				return [];
		}
	});

	const commands = $derived([
		...executionCommands,
		...(change.rollback_started_at && change.execution_state !== 'rolled_back'
			? [{ command: 'complete_rollback' }]
			: []),
		...verificationCommands
	]);

	function stateTone(state: string, category: 'execution' | 'verification' | 'authorization') {
		if (category === 'authorization') {
			if (state === 'valid') return 'active';
			if (['revoked', 'invalidated'].includes(state)) return 'danger';
			return 'warning';
		}
		if (['succeeded', 'passed'].includes(state)) return 'active';
		if (state === 'failed') return 'danger';
		if (['in_progress', 'paused', 'waived'].includes(state)) return 'warning';
		return 'muted';
	}

	function displayValue(value: unknown): string {
		if (value === null || value === undefined || value === '') return 'Not recorded';
		if (typeof value === 'string') return value;
		if (Array.isArray(value)) {
			if (value.length === 0) return 'None';
			return value
				.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
				.join('; ');
		}
		return JSON.stringify(value);
	}

	function dateLabel(value?: number | null): string {
		return value ? new Date(value).toLocaleString() : 'Time unavailable';
	}
</script>

<svelte:head><title>{change.title} — Change Request</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-5">
	<PageHeader
		eyebrow="Change request"
		title={change.title}
		id={change.id}
		version={change.version}
		description={change.summary}
		backHref={resolve('/work/browse?type=change_request')}
		backLabel="Browse changes"
	>
		{#snippet metadata()}
			<p class="pt-1 text-[length:var(--text-label)] text-on-surface-variant">
				Next semantic action:
				<span class="font-mono text-on-surface">{change.next_action ?? 'none'}</span>
			</p>
		{/snippet}
	</PageHeader>

	<CommandFeedback form={form as never} />

	<div class="grid gap-4 md:grid-cols-3" aria-label="Change state">
		<StatTile
			label="Execution"
			value={change.execution_state.replaceAll('_', ' ')}
			description={change.result_summary ??
				change.failure_summary ??
				'No execution result recorded.'}
			tone={stateTone(change.execution_state, 'execution')}
		/>
		<StatTile
			label="Verification"
			value={change.verification_state.replaceAll('_', ' ')}
			description={change.verification_waived_reason ?? 'Acceptance evidence state.'}
			tone={stateTone(change.verification_state, 'verification')}
		/>
		<StatTile
			label="Authorization"
			value={authorizationState.replaceAll('_', ' ')}
			description={change.authorization?.reason ?? 'Permission state for this exact revision.'}
			tone={stateTone(authorizationState, 'authorization')}
		/>
	</div>

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
		<div class="space-y-5">
			<Section
				title="Scope, risk, and safety"
				description="The execution boundary attached to this exact change revision."
			>
				<dl>
					<DataRow
						label="Allowed"
						value={change.scope_allowed?.join('; ') || 'No allowed scope recorded'}
					/>
					<DataRow
						label="Prohibited"
						value={change.scope_prohibited?.join('; ') || 'No prohibited scope recorded'}
					/>
					<DataRow label="Targets" value={displayValue(change.targets)} />
					<DataRow label="Risk" value={displayValue(change.risk)} />
					<DataRow label="Safety" value={displayValue(change.safety)} />
				</dl>
			</Section>

			<Section
				title="Acceptance criteria"
				description="Verification must satisfy each criterion with evidence or record an explicit waiver."
			>
				{#if change.acceptance_criteria?.length}
					<ul class="divide-y divide-outline-variant/60">
						{#each change.acceptance_criteria as criterion (criterion.id)}
							{@const criterionState = change.criteria_status?.[criterion.id]?.state ?? 'open'}
							<li class="flex gap-3 py-3 first:pt-0 last:pb-0">
								<StatusBadge
									type="change_verification"
									value={criterionState}
									label={criterionState}
								/>
								<div class="min-w-0">
									<p class="text-on-surface">{criterion.text}</p>
									<p class="mt-1 font-mono text-[length:var(--text-label)] text-on-surface-variant">
										{criterion.id}
									</p>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-on-surface-variant">No acceptance criteria recorded.</p>
				{/if}
			</Section>

			{#if plan}
				<Section
					title="Execution plan"
					description="The plan revision and review disposition are related facts, not interchangeable authority."
					accent="purple"
				>
					<div class="flex flex-wrap items-center gap-2">
						<StatusBadge type="plan" value={plan.state} />
						<StatusBadge
							type="review"
							value={plan.review_disposition}
							label={`Review: ${plan.review_disposition ?? 'unreviewed'}`}
						/>
						<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">
							Revision {plan.revision ?? change.plan_revision ?? '—'}
						</span>
					</div>
					{#if plan.summary}
						<p class="mt-3 leading-relaxed text-on-surface-variant">{plan.summary}</p>
					{/if}
					{#if plan.steps?.length}
						<ol class="mt-4 list-decimal space-y-3 pl-5">
							{#each plan.steps as step, index (index)}
								<li class="pl-1 text-on-surface">
									{step.step ?? 'Unnamed step'}
									{#if step.expected_output}
										<span class="block text-[length:var(--text-label)] text-on-surface-variant">
											Expected: {step.expected_output}
										</span>
									{/if}
								</li>
							{/each}
						</ol>
					{/if}
					{#if plan.revisions?.length}
						<div class="mt-5 border-t border-outline-variant/60 pt-4">
							<p class="font-semibold text-on-surface">Supersession chain</p>
							<ol class="mt-2 space-y-2">
								{#each plan.revisions as revision, index (revision.id ?? revision.revision ?? index)}
									<li class="flex flex-wrap items-center gap-2 text-[length:var(--text-label)]">
										<span class="font-mono text-on-surface">
											r{revision.revision ?? index + 1}
										</span>
										<StatusBadge type="plan" value={revision.state} />
										<StatusBadge type="review" value={revision.review_disposition} />
										{#if revision.supersedes}
											<span class="text-on-surface-variant">supersedes {revision.supersedes}</span>
										{/if}
									</li>
								{/each}
							</ol>
						</div>
					{/if}
				</Section>
			{/if}

			<Section
				title="Authorizations"
				description="Permission grants pinned to exact revisions, scope, and authority basis."
				eyebrow="Execution authority"
				accent="warning"
			>
				{#if change.authorizations?.length}
					<ul class="divide-y divide-outline-variant/60">
						{#each change.authorizations as authorization (authorization.id)}
							<li class="py-4 first:pt-0 last:pb-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-[length:var(--text-label)] text-on-surface">
										{authorization.id}
									</span>
									<StatusBadge type="authorization" value={authorization.effectiveness} />
								</div>
								<p class="mt-2 text-on-surface">
									Granted by {authorization.authorizer ?? 'Unknown authorizer'}
								</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									Pinned change revision {authorization.subject_revision ?? 'not recorded'}
									{authorization.plan_revision
										? ` · plan revision ${authorization.plan_revision}`
										: ''}
								</p>
								<p
									class="mt-1 break-all font-mono text-[length:var(--text-label)] text-on-surface-variant"
								>
									Scope fingerprint: {authorization.scope_fingerprint ?? 'not recorded'}
								</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									Basis: {authorization.authority_basis?.kind ?? 'not recorded'}
									{#if authorization.authority_basis?.source_ref}
										· {authorization.authority_basis.source_ref.label ??
											authorization.authority_basis.source_ref.ref}
									{/if}
								</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									Conditions: {displayValue(authorization.conditions)}
								</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									Granted {dateLabel(authorization.granted_at)}
									{authorization.expires_at
										? ` · expires ${dateLabel(authorization.expires_at)}`
										: ' · no expiry'}
									{authorization.one_time ? ' · one-time grant' : ' · reusable grant'}
								</p>
								{#if authorization.consumed_at}
									<p class="mt-1 text-[length:var(--text-label)] text-status-warning">
										Consumed {dateLabel(authorization.consumed_at)}
									</p>
								{/if}
								{#if authorization.revoked_at}
									<p class="mt-1 text-[length:var(--text-label)] text-status-danger">
										Revoked {dateLabel(authorization.revoked_at)}
										{authorization.revoke_reason ? ` · ${authorization.revoke_reason}` : ''}
									</p>
								{/if}
								{#if authorization.effectiveness_reason}
									<p class="mt-1 text-[length:var(--text-label)] text-status-warning">
										{authorization.effectiveness_reason}
									</p>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-status-warning">No permission grant exists for this change revision.</p>
				{/if}
			</Section>

			<Section
				title="Reviews"
				description="Evaluations of quality and readiness — never execution authority."
				eyebrow="Advisory evidence"
				accent="info"
			>
				{#if change.reviews?.length}
					<ul class="divide-y divide-outline-variant/60">
						{#each change.reviews as review (review.id)}
							<li class="py-4 first:pt-0 last:pb-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-[length:var(--text-label)] text-on-surface">
										{review.id}
									</span>
									<StatusBadge type="review" value={review.outcome} />
								</div>
								<p class="mt-2 text-on-surface">{review.summary ?? 'No summary recorded.'}</p>
								<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
									{review.reviewer ?? 'Unknown reviewer'} · pinned revision
									{review.subject_revision ?? 'not recorded'} · {dateLabel(review.submitted_at)}
								</p>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-on-surface-variant">No evaluations have been recorded.</p>
				{/if}
			</Section>

			{#if change.history?.length}
				<Section title="Timeline" description="Immutable command history and authority acts.">
					<Timeline events={change.history} />
				</Section>
			{/if}
		</div>

		<Section title="Revision context" description="Identifiers and current placement.">
			<dl>
				<DataRow label="Change revision" value={change.revision_id ?? 'Not recorded'} mono />
				<DataRow label="Plan" value={change.plan_id ?? 'Not assigned'} mono />
				<DataRow label="Plan revision" value={change.plan_revision ?? 'Not assigned'} />
				<DataRow label="Plan review" value={change.plan_review_disposition ?? 'Not reviewed'} />
				<DataRow label="Authorization" value={change.authorization?.id ?? 'No active grant'} mono />
				<DataRow label="Area" value={change.area_id ?? 'Not assigned'} mono />
				<DataRow label="Updated" value={dateLabel(change.updated_at)} />
			</dl>
		</Section>
	</div>

	<CommandBar
		{commands}
		targetId={change.id}
		expectedVersion={change.version}
		form={form as never}
		title="Execution and verification controls"
	/>
</div>
