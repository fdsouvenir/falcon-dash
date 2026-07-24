<script lang="ts">
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible/index.js';

	interface SourceRef {
		kind?: string;
		ref?: string;
		label?: string;
		locator?: string;
		captured_at?: number;
	}

	interface Props {
		sources?: SourceRef[] | string | null;
		title?: string;
	}

	let { sources = [], title = 'Sources' }: Props = $props();

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
						<p class="font-medium text-on-surface">
							{source.label ?? source.ref ?? 'Source reference'}
						</p>
						<p
							class="mt-1 break-all font-mono text-[length:var(--text-label)] text-on-surface-variant"
						>
							{source.kind ?? 'source'} · {source.ref ?? 'Reference unavailable'}
							{source.locator ? ` · ${source.locator}` : ''}
						</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-3 py-4 text-[length:var(--text-label)] text-on-surface-variant">
				No source references recorded.
			</p>
		{/if}
	</CollapsibleContent>
</Collapsible>
