<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';

	interface TimelineEvent {
		id?: string;
		occurred_at?: number;
		summary?: string;
		event_type?: string;
		command?: string;
		version_from?: number | null;
		version_to?: number | null;
		actor?: { label?: string; kind?: string };
		authority_act?: boolean;
		source_refs?: unknown[];
	}

	interface Props {
		events: TimelineEvent[];
	}

	let { events }: Props = $props();

	function formatTime(value?: number): string {
		if (!value) return 'Time unavailable';
		return new Date(value).toLocaleString();
	}
</script>

{#if events.length}
	<ol class="relative ml-2 border-l border-outline-variant">
		{#each events as event, index (event.id ?? index)}
			<li class="relative pb-5 pl-5 last:pb-0">
				<span
					class="absolute -left-1.5 top-1.5 size-3 rounded-full border-2 border-surface-container bg-status-info"
					aria-hidden="true"
				></span>
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-[length:var(--text-body)] font-medium text-on-surface">
						{event.summary ?? event.event_type ?? 'Work event'}
					</p>
					{#if event.authority_act}
						<StatusBadge type="review" value="commented" label="Authority act" />
					{/if}
				</div>
				<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
					{formatTime(event.occurred_at)} · {event.actor?.label ?? 'Unknown actor'}
					{#if event.event_type}
						· <span class="font-mono">{event.event_type}</span>{/if}
					{#if event.version_from !== null && event.version_from !== undefined}
						· v{event.version_from}→v{event.version_to}
					{/if}
				</p>
				{#if event.authority_act}
					<p class="mt-1 text-[length:var(--text-label)] text-status-purple">
						Claimed human authority{event.source_refs?.length
							? ` · ${event.source_refs.length} source${event.source_refs.length === 1 ? '' : 's'}`
							: ''}
					</p>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
