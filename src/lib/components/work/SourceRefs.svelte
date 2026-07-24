<script lang="ts">
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible/index.js';
	import type { SourceRef as Work3SourceRef } from '$lib/work3-shared/types.js';

	type SourceRef = Work3SourceRef & {
		available?: boolean;
		reason?: string;
	};

	interface Props {
		sources?: SourceRef[] | string | null;
		title?: string;
		omittedCount?: number;
	}

	let { sources = [], title = 'Sources', omittedCount = 0 }: Props = $props();

	const normalized = $derived.by(() => {
		if (Array.isArray(sources)) return sources;
		if (!sources) return [];
		try {
			const parsed = JSON.parse(sources);
			return Array.isArray(parsed) ? (parsed as SourceRef[]) : [];
		} catch {
			return [];
		}
	});
</script>

<Collapsible>
	<CollapsibleTrigger
		class="falcon-focus touch-target flex w-full items-center justify-between rounded-[var(--md-sys-shape-corner-small)] bg-surface-container-high px-3 py-2 text-left"
	>
		<span class="font-medium text-on-surface">{title}</span>
		<span class="text-[length:var(--text-label)] text-on-surface-variant">
			{normalized.length} reference{normalized.length === 1 ? '' : 's'}
		</span>
	</CollapsibleTrigger>
	<CollapsibleContent>
		{#if normalized.length}
			<ul
				class="mt-2 divide-y divide-outline-variant/60 rounded-[var(--md-sys-shape-corner-small)] border border-outline-variant/70 px-3"
			>
				{#each normalized as source, index (`${source.kind}-${source.ref}-${index}`)}
					<li class="py-3">
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-medium text-on-surface">
								{source.label ?? source.ref ?? 'Source reference'}
							</p>
							{#if source.available === true}
								<span
									class="rounded-full bg-status-active-bg px-2 py-0.5 text-[length:var(--text-badge)] font-semibold text-status-active"
								>
									Available
								</span>
							{:else if source.available === false}
								<span
									class="rounded-full bg-status-danger-bg px-2 py-0.5 text-[length:var(--text-badge)] font-semibold text-status-danger"
								>
									Unavailable
								</span>
							{/if}
						</div>
						<p
							class="mt-1 break-all font-mono text-[length:var(--text-label)] text-on-surface-variant"
						>
							{source.kind ?? 'source'} · {source.ref ?? 'Reference unavailable'}
							{source.locator ? ` · ${source.locator}` : ''}
						</p>
						{#if source.available === false && source.reason}
							<p class="mt-1 text-[length:var(--text-label)] text-status-danger">
								{source.reason}
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-3 py-4 text-[length:var(--text-label)] text-on-surface-variant">
				No source references recorded.
			</p>
		{/if}
		{#if omittedCount > 0}
			<p
				class="mt-2 rounded-[var(--md-sys-shape-corner-small)] bg-status-warning-bg px-3 py-2 text-[length:var(--text-label)] text-status-warning"
			>
				{omittedCount} additional reference{omittedCount === 1 ? ' was' : 's were'} not resolved in this
				view because the source limit was reached.
			</p>
		{/if}
	</CollapsibleContent>
</Collapsible>
