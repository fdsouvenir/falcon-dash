<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Nav from '../Nav.svelte';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const searchTypes = [
		'task',
		'question',
		'decision',
		'finding',
		'project',
		'change_request',
		'area'
	];

	function workHref(id: string, type: string): string {
		if (type === 'task') return resolve('/work/tasks/[id]', { id });
		if (type === 'question') return resolve('/work/questions/[id]', { id });
		if (type === 'decision') return resolve('/work/decisions/[id]', { id });
		if (type === 'change_request') return resolve('/work/changes/[id]', { id });
		if (type === 'project') return resolve('/work/projects/[id]', { id });
		if (type === 'finding') return resolve('/work/findings/[id]', { id });
		return resolve('/work/browse');
	}
</script>

<svelte:head><title>Browse — Work v3</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
	<h1 class="text-xl font-semibold text-white">Browse</h1>
	<Nav />

	<form method="GET" class="flex flex-wrap gap-2">
		<input
			name="q"
			value={data.query}
			placeholder="Search all Work…"
			class="min-w-64 flex-1 rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
		/>
		<select
			name="type"
			class="rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
		>
			<option value="">all types</option>
			{#each searchTypes as searchType (searchType)}
				<option value={searchType} selected={data.type === searchType}>{searchType}</option>
			{/each}
		</select>
		<button class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
			>Search</button
		>
	</form>

	{#if data.searchError}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			{data.searchError}
		</div>
	{/if}

	{#if data.query && !data.searchError}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Results for “{data.query}” ({data.results.length})
			</div>
			{#if data.results.length === 0}
				<p class="px-4 py-3 text-sm text-status-muted">No Work matches this search.</p>
			{:else}
				<ul class="divide-y divide-surface-border/40">
					{#each data.results as result (result.id)}
						<li class="px-4 py-2 text-sm">
							<a
								class="text-blue-400 hover:underline"
								href={workHref(String(result.id), String(result.type))}
							>
								{result.title}
							</a>
							<span class="ml-2 text-xs text-status-muted">{result.type} · {result.id}</span>
							{#if result.snippet}<span class="block text-xs text-white/60">{result.snippet}</span
								>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			<span class="font-mono text-xs">{form.error.code}</span> — {form.error.message}
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
			<div class="flex flex-wrap gap-2">
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
			<button
				class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
				>Create Task</button
			>
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
				>Create Area</button
			>
			<p class="text-xs text-status-muted">
				Areas: {#each data.areas as area, index (area.id)}{index > 0 ? ', ' : ''}{area.title} ({area.active_work_count}){/each}
			</p>
		</form>
	</div>

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Tasks ({data.taskTotal})
		</div>
		{#if data.tasks.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No tasks.</p>
		{:else}
			<ul class="divide-y divide-surface-border/40">
				{#each data.tasks as task (task.id)}
					<li class="px-4 py-2 text-sm">
						<a
							class="text-blue-400 hover:underline"
							href={resolve('/work/tasks/[id]', { id: String(task.id) })}>{task.title}</a
						>
						<span class="ml-2 text-xs text-status-muted">{task.status} · {task.actionability}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if data.findings.length > 0}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Current Findings
			</div>
			<ul class="divide-y divide-surface-border/40">
				{#each data.findings as finding (finding.id)}
					<li class="px-4 py-2 text-sm">
						<a
							class="text-blue-400 hover:underline"
							href={resolve('/work/findings/[id]', { id: String(finding.id) })}>{finding.title}</a
						>
						<span class="ml-2 text-xs text-status-muted"
							>{finding.confidence} · {finding.validity}</span
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
