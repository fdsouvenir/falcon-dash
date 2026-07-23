<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const statusOptions = [
		'backlog',
		'ready',
		'in_progress',
		'waiting',
		'in_review',
		'completed',
		'cancelled'
	];

	function actionabilityClass(actionability: unknown): string {
		switch (actionability) {
			case 'blocked':
				return 'text-red-400';
			case 'waiting':
				return 'text-amber-400';
			case 'actionable':
				return 'text-emerald-400';
			case 'terminal':
				return 'text-status-muted';
			default:
				return 'text-white/70';
		}
	}
</script>

<svelte:head><title>Work v3</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	<div class="flex items-baseline justify-between">
		<h1 class="text-xl font-semibold text-white">Work v3</h1>
		<p class="text-xs text-status-muted">{data.taskTotal} task(s)</p>
	</div>

	{#if form?.error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			<span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}
			{#if form.error.alternatives?.length}
				<span class="text-xs text-red-400">Try: {form.error.alternatives.join(', ')}</span>
			{/if}
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2">
		<form
			method="POST"
			action="?/create_task"
			use:enhance
			class="space-y-2 rounded border border-surface-border bg-surface-1 p-4"
		>
			<h2 class="text-sm font-medium text-white">New Task</h2>
			<input
				name="title"
				placeholder="Action-oriented title"
				value={form?.form === 'task' ? (form.values?.title ?? '') : ''}
				class="w-full rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
			/>
			<div class="flex gap-2">
				<select
					name="area_id"
					class="rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
				>
					{#each data.areas as area (area.id)}
						<option value={area.id}>{area.title}</option>
					{/each}
				</select>
				<select
					name="priority"
					class="rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
				>
					<option value="">priority…</option>
					{#each ['low', 'normal', 'high', 'urgent'] as priority (priority)}
						<option value={priority}>{priority}</option>
					{/each}
				</select>
				<input
					name="owner"
					placeholder="owner"
					class="w-28 rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
				/>
			</div>
			<input
				name="summary"
				placeholder="Concise summary (optional)"
				value={form?.form === 'task' ? (form.values?.summary ?? '') : ''}
				class="w-full rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
			/>
			<button
				class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
			>
				Create Task
			</button>
		</form>

		<form
			method="POST"
			action="?/create_area"
			use:enhance
			class="space-y-2 rounded border border-surface-border bg-surface-1 p-4"
		>
			<h2 class="text-sm font-medium text-white">New Area</h2>
			<input
				name="title"
				placeholder="Sphere of responsibility"
				value={form?.form === 'area' ? (form.values?.title ?? '') : ''}
				class="w-full rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
			/>
			<input
				name="summary"
				placeholder="Summary (optional)"
				class="w-full rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
			/>
			<button
				class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
			>
				Create Area
			</button>
			<p class="text-xs text-status-muted">
				Areas: {#each data.areas as area, index (area.id)}{index > 0 ? ', ' : ''}{area.title}
					({area.active_work_count}){/each}
			</p>
		</form>
	</div>

	<form method="GET" class="flex gap-2">
		<select
			name="status"
			class="rounded border border-surface-border bg-surface-2 px-3 py-1.5 text-sm text-white"
		>
			<option value="">all statuses</option>
			{#each statusOptions as status (status)}
				<option value={status} selected={data.statusFilter === status}>{status}</option>
			{/each}
		</select>
		<select
			name="area"
			class="rounded border border-surface-border bg-surface-2 px-3 py-1.5 text-sm text-white"
		>
			<option value="">all areas</option>
			{#each data.areas as area (area.id)}
				<option value={area.id} selected={data.areaFilter === area.id}>{area.title}</option>
			{/each}
		</select>
		<button class="rounded border border-surface-border px-3 py-1.5 text-sm text-white/80">
			Filter
		</button>
	</form>

	<div class="rounded border border-surface-border bg-surface-1">
		{#if data.tasks.length === 0}
			<p class="px-4 py-6 text-sm text-status-muted">
				No tasks match. Nothing requires attention here.
			</p>
		{:else}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="text-xs text-status-muted">
						<th class="px-4 py-2 font-medium">ID</th>
						<th class="px-4 py-2 font-medium">Title</th>
						<th class="px-4 py-2 font-medium">Status</th>
						<th class="px-4 py-2 font-medium">Actionability</th>
						<th class="px-4 py-2 font-medium">Owner</th>
						<th class="px-4 py-2 font-medium">Priority</th>
					</tr>
				</thead>
				<tbody>
					{#each data.tasks as task (task.id)}
						<tr class="border-t border-surface-border/60 hover:bg-surface-2/40">
							<td class="px-4 py-2"
								><a
									class="text-blue-400 hover:underline"
									href={resolve('/work3/tasks/[id]', { id: String(task.id) })}>{task.id}</a
								></td
							>
							<td class="px-4 py-2 text-white">{task.title}</td>
							<td class="px-4 py-2 text-white/80">{task.status}</td>
							<td class="px-4 py-2 {actionabilityClass(task.actionability)}">
								{task.actionability}{#if task.blocker_summary}<span
										class="block text-xs text-red-400/80">{task.blocker_summary}</span
									>{/if}
							</td>
							<td class="px-4 py-2 text-white/70">{task.owner ?? '—'}</td>
							<td class="px-4 py-2 text-white/70">{task.priority ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Open Questions ({data.questionTotal})
			</div>
			{#if data.questions.length === 0}
				<p class="px-4 py-3 text-sm text-status-muted">No open questions.</p>
			{:else}
				<ul class="divide-y divide-surface-border/60">
					{#each data.questions as question (question.id)}
						<li class="px-4 py-2 text-sm">
							<a
								class="text-blue-400 hover:underline"
								href={resolve('/work3/questions/[id]', { id: String(question.id) })}
								>{question.id}</a
							>
							<span class="ml-2 text-white/80">{question.question}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Decisions
			</div>
			{#if data.decisions.length === 0}
				<p class="px-4 py-3 text-sm text-status-muted">No decisions.</p>
			{:else}
				<ul class="divide-y divide-surface-border/60">
					{#each data.decisions as decision (decision.id)}
						<li class="px-4 py-2 text-sm">
							<a
								class="text-blue-400 hover:underline"
								href={resolve('/work3/decisions/[id]', { id: String(decision.id) })}
								>{decision.id}</a
							>
							<span class="ml-2 text-white/80">{decision.title}</span>
							<span class="ml-1 text-xs text-status-muted">({decision.status})</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Current Findings
			</div>
			{#if data.findings.length === 0}
				<p class="px-4 py-3 text-sm text-status-muted">No findings.</p>
			{:else}
				<ul class="divide-y divide-surface-border/60">
					{#each data.findings as finding (finding.id)}
						<li class="px-4 py-2 text-sm">
							<a
								class="text-blue-400 hover:underline"
								href={resolve('/work3/findings/[id]', { id: String(finding.id) })}>{finding.id}</a
							>
							<span class="ml-2 text-white/80">{finding.title}</span>
							<span class="ml-1 text-xs text-status-muted">({finding.confidence})</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
