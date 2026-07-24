<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		EmptyState,
		FocusChips,
		PageHeader,
		Section,
		StatusBadge
	} from '$lib/components/work/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { filterByFocus, isTerminalBrowseItem } from '$lib/work3/focus.js';
	import { typeLabel, workHref } from '$lib/work3/hrefs.js';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { PageData } from './$types.js';

	const browseTypes = [
		{ value: '', label: 'All' },
		{ value: 'task', label: 'Tasks' },
		{ value: 'question', label: 'Questions' },
		{ value: 'decision', label: 'Decisions' },
		{ value: 'change_request', label: 'Changes' },
		{ value: 'project', label: 'Projects' },
		{ value: 'finding', label: 'Findings' },
		{ value: 'area', label: 'Areas' }
	];

	let { data }: { data: PageData } = $props();

	const items = $derived(data.items as Array<Record<string, unknown>>);
	const filteredItems = $derived(
		data.type ? filterByFocus(items, data.type, data.focus, data.now) : items
	);
	const currentItems = $derived(
		filteredItems.filter((item) => !isTerminalBrowseItem(itemType(item), item))
	);
	const terminalItems = $derived(
		filteredItems.filter((item) => isTerminalBrowseItem(itemType(item), item))
	);

	function itemType(item: Record<string, unknown>): string {
		return String(item.__type ?? item.type ?? data.type ?? '');
	}

	function itemTitle(item: Record<string, unknown>): string {
		return String(item.title ?? item.question ?? item.name ?? item.id ?? 'Untitled Work');
	}

	function itemStatus(item: Record<string, unknown>): { type: string; value: string } | null {
		const type = itemType(item);
		if (type === 'change_request') {
			return { type: 'change_execution', value: String(item.execution_state ?? 'unknown') };
		}
		if (type === 'finding') return { type: 'finding', value: String(item.validity ?? 'unknown') };
		if (type === 'area') return null;
		const value = item.status;
		return typeof value === 'string' ? { type, value } : null;
	}

	function itemSummary(item: Record<string, unknown>): string {
		const type = itemType(item);
		if (type === 'task') {
			return [
				item.actionability,
				item.waiting_on ? `waiting on ${item.waiting_on}` : null,
				item.blocker_summary
			]
				.filter(Boolean)
				.join(' · ');
		}
		if (type === 'project') {
			const progress = item.progress as Record<string, unknown> | undefined;
			return [
				item.health ? `${String(item.health).replaceAll('_', ' ')} health` : null,
				progress ? `${progress.work_open ?? 0} open` : null,
				item.current_next_valid ? `next ${item.current_next_item_id}` : 'no valid next'
			]
				.filter(Boolean)
				.join(' · ');
		}
		if (type === 'change_request') {
			const authorization = item.authorization as { state?: unknown } | undefined;
			return `Verification ${item.verification_state ?? 'unknown'} · Authorization ${authorization?.state ?? 'unknown'}`;
		}
		if (type === 'finding') return `${item.confidence ?? 'unknown'} confidence`;
		if (type === 'area') return `${item.active_work_count ?? 0} active Work items`;
		return '';
	}

	function typeHref(type: string): string {
		const params = new SvelteURLSearchParams();
		if (type) params.set('type', type);
		if (data.query) params.set('q', data.query);
		const query = params.toString();
		return `${resolve('/work/browse')}${query ? `?${query}` : ''}`;
	}

	function snippetParts(snippet: unknown): Array<{ text: string; highlighted: boolean }> {
		const source = String(snippet ?? '');
		const parts: Array<{ text: string; highlighted: boolean }> = [];
		let highlighted = false;
		let buffer = '';
		for (const character of source) {
			if (character === '[' || character === ']') {
				if (buffer) parts.push({ text: buffer, highlighted });
				buffer = '';
				highlighted = character === '[';
			} else {
				buffer += character;
			}
		}
		if (buffer) parts.push({ text: buffer, highlighted });
		return parts;
	}
</script>

{#snippet workRow(item: Record<string, unknown>)}
	{@const type = itemType(item)}
	{@const status = itemStatus(item)}
	<a
		href={workHref(type, String(item.id))}
		class="falcon-focus touch-target grid gap-2 rounded-[var(--md-sys-shape-corner-medium)] px-2 py-4 hover:bg-surface-container-high sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
	>
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="break-words font-semibold text-on-surface">{itemTitle(item)}</h3>
				<span
					class="rounded-full bg-surface-container-highest px-2 py-0.5 text-[length:var(--text-badge)] font-semibold text-on-surface-variant"
				>
					{typeLabel(type)}
				</span>
				{#if status}<StatusBadge type={status.type} value={status.value} />{/if}
			</div>
			{#if itemSummary(item)}
				<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
					{itemSummary(item)}
				</p>
			{/if}
		</div>
		<span class="font-mono text-[length:var(--text-label)] text-on-surface-variant">{item.id}</span>
	</a>
{/snippet}

<svelte:head><title>Browse — Work</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-5">
	<PageHeader
		eyebrow="Search and filter"
		title="Browse"
		description="Inspect existing Work and knowledge objects, including terminal and archived records."
	/>

	<Section
		title="Search Work"
		description="Full-text search uses titles and the indexed Work body."
	>
		<form method="GET" class="flex flex-col gap-3 sm:flex-row sm:items-end">
			{#if data.type}<input type="hidden" name="type" value={data.type} />{/if}
			<div class="min-w-0 flex-1">
				<Field label="Search terms">
					{#snippet children(context)}
						<Input
							id={context.id}
							name="q"
							value={data.query}
							placeholder="Search existing Work…"
							aria-describedby={context.describedBy}
						/>
					{/snippet}
				</Field>
			</div>
			<Button type="submit" class="touch-target">Search</Button>
		</form>

		<nav class="mt-4 flex gap-1 overflow-x-auto" aria-label="Browse object types">
			{#each browseTypes as type (type.value)}
				<a
					href={typeHref(type.value)}
					aria-current={data.type === type.value ? 'page' : undefined}
					class="falcon-focus touch-target inline-flex shrink-0 rounded-[var(--md-sys-shape-corner-medium)] px-3 py-2 text-[length:var(--text-label)] font-semibold {data.type ===
					type.value
						? 'bg-primary-container text-on-primary-container'
						: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}"
				>
					{type.label}
				</a>
			{/each}
		</nav>
	</Section>

	{#if data.searchError}
		<div
			class="rounded-[var(--md-sys-shape-corner-large)] border border-status-danger/45 bg-status-danger-bg px-4 py-3 text-status-danger"
			role="alert"
		>
			<p class="font-semibold">Search could not run</p>
			<p class="mt-1 text-[length:var(--text-label)]">{data.searchError}</p>
		</div>
	{/if}

	{#if data.query && !data.searchError}
		<Section
			title={`Results for “${data.query}”`}
			description={`${data.results.length} full-text matches${data.type ? ` in ${typeLabel(data.type)}` : ''}.`}
			accent="info"
		>
			{#if data.results.length === 0}
				<EmptyState
					title="No search matches"
					description="The index returned a definitive empty result."
				/>
			{:else}
				<div class="divide-y divide-outline-variant/60">
					{#each data.results as result (result.id)}
						<a
							class="falcon-focus touch-target block rounded-[var(--md-sys-shape-corner-medium)] px-2 py-4 hover:bg-surface-container-high"
							href={workHref(String(result.type), String(result.id))}
						>
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-semibold text-on-surface">{result.title}</span>
								<span class="text-[length:var(--text-label)] text-on-surface-variant">
									{typeLabel(String(result.type))} ·
									<span class="font-mono">{result.id}</span>
								</span>
							</div>
							{#if result.snippet}
								<p class="mt-2 text-[length:var(--text-label)] text-on-surface-variant">
									{#each snippetParts(result.snippet) as part, index (`${index}:${part.highlighted}:${part.text}`)}
										{#if part.highlighted}
											<mark class="bg-primary-container px-0.5 text-on-primary-container"
												>{part.text}</mark
											>
										{:else}
											{part.text}
										{/if}
									{/each}
								</p>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</Section>
	{/if}

	{#if data.type}
		<FocusChips type={data.type} {items} active={data.focus} now={data.now} />
	{/if}

	<Section
		title={data.type ? typeLabel(data.type) : 'All indexed Work'}
		description={`${currentItems.length} current records${data.focus ? ' match this focus' : ''}.`}
	>
		{#if currentItems.length === 0}
			<EmptyState
				title="No current records"
				description="This type and focus combination has no current Work."
			/>
		{:else}
			<div class="divide-y divide-outline-variant/60">
				{#each currentItems as item (String(item.__type) + String(item.id))}
					{@render workRow(item)}
				{/each}
			</div>
		{/if}
	</Section>

	{#if terminalItems.length}
		<details
			class="rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container"
		>
			<summary
				class="falcon-focus touch-target cursor-pointer rounded-[var(--md-sys-shape-corner-large)] px-4 py-4 font-semibold text-on-surface"
			>
				Terminal and archived ({terminalItems.length})
			</summary>
			<div class="divide-y divide-outline-variant/60 border-t border-outline-variant/70 px-4">
				{#each terminalItems as item (String(item.__type) + String(item.id))}
					{@render workRow(item)}
				{/each}
			</div>
		</details>
	{/if}
</div>
