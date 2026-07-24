<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { CommandFeedback, CommandForm } from '$lib/components/work/index.js';
	import { parseQuestionSections } from '$lib/work3/sections.js';
	import type { ActionData, PageData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/* eslint-disable @typescript-eslint/no-explicit-any -- reader projections are dynamic records */
	const question = $derived(data.question as Record<string, any>);
	const questionSections = $derived(parseQuestionSections(question.context ?? ''));
</script>

<svelte:head><title>{question.id} — Question</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-5 p-6">
	<div>
		<a href={resolve('/work')} class="text-xs text-blue-400 hover:underline">← Work v3</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h1 class="text-lg font-semibold text-white">{question.question}</h1>
			<span class="font-mono text-xs text-status-muted">{question.id} · v{question.version}</span>
		</div>
		<p class="text-sm text-white/70">
			<span class="font-medium">{question.status}</span>
			{#if question.priority}· {question.priority}{/if}
			{#if question.steward}· steward {question.steward}{/if}
		</p>
		{#if question.impact}<p class="mt-1 text-sm text-amber-200/90">
				Impact: {question.impact}
			</p>{/if}
		{#if question.working_hypothesis}
			<p class="mt-1 text-sm text-status-muted">
				Hypothesis ({question.working_hypothesis.confidence}): {question.working_hypothesis.text}
			</p>
		{/if}
	</div>

	{#if question.context}
		<section class="space-y-2" aria-label="Question brief">
			{#each questionSections as section (section.id)}
				<details
					open={section.defaultOpen}
					class="rounded border border-surface-border bg-surface-1 px-4 py-3"
				>
					<summary class="cursor-pointer text-sm font-medium text-white">{section.title}</summary>
					<p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
						{section.content}
					</p>
				</details>
			{/each}
		</section>
	{/if}

	<CommandFeedback form={form as never} />

	{#if question.answer}
		<div class="rounded border border-emerald-800/60 bg-emerald-950/20 p-4">
			<p class="text-xs font-medium uppercase tracking-wide text-emerald-400">
				Answer · {question.answer.confidence} · {question.answer.answerer}
			</p>
			<p class="mt-1 text-sm text-white">{question.answer.answer}</p>
			{#if question.answer.source_refs?.length}
				<p class="mt-2 text-xs text-status-muted">
					Sources: {question.answer.source_refs
						.map((ref: Record<string, unknown>) => ref.label ?? ref.ref)
						.join(' · ')}
				</p>
			{/if}
		</div>
	{/if}

	<div class="space-y-3 rounded border border-surface-border bg-surface-1 p-4">
		<h2 class="text-sm font-medium text-white">Actions</h2>
		{#if question.status === 'open' || question.status === 'answered'}
			<CommandForm
				command={question.status === 'answered' ? 'revise_answer' : 'answer_question'}
				targetId={question.id}
				expectedVersion={question.version}
				form={form as never}
				compact
			/>
		{/if}
		{#if question.status === 'open'}
			<CommandForm
				command="withdraw_question"
				targetId={question.id}
				expectedVersion={question.version}
				form={form as never}
				compact
			/>
		{:else}
			<form method="POST" action="?/command" use:enhance class="flex gap-2">
				<input type="hidden" name="command" value="reopen_question" />
				<input type="hidden" name="expected_version" value={question.version} />
				<input
					name="payload_reason"
					placeholder="reason (required)"
					class="w-64 rounded border border-surface-border bg-surface-2 px-2 py-1 text-sm text-white"
				/>
				<button
					class="rounded border border-surface-border px-3 py-1.5 text-sm text-white/80 hover:bg-surface-2"
					>Reopen</button
				>
			</form>
		{/if}
	</div>

	{#if question.answer_history?.length > 1}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Answer history
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each question.answer_history as revision (revision.id)}
					<li class="px-4 py-2 text-sm">
						<span class="text-white/80">{revision.answer}</span>
						<span class="block text-xs text-status-muted">
							{new Date(revision.created_at).toLocaleString()} · {revision.answerer} · {revision.confidence}
							{#if revision.is_current}· current{/if}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if question.history?.length}
		<div class="rounded border border-surface-border bg-surface-1">
			<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
				Timeline
			</div>
			<ul class="divide-y divide-surface-border/60">
				{#each question.history as event (event.id)}
					<li class="px-4 py-2 text-sm">
						<span class="text-white/80">{event.summary}</span>
						<span class="block text-xs text-status-muted">
							{new Date(event.occurred_at).toLocaleString()} · {event.actor.label}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
