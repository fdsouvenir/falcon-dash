<script lang="ts">
	interface Waiting {
		waiting_on?: string;
		reason?: string;
		resume_condition?: string;
		follow_up_at?: number | null;
	}

	interface Props {
		waiting: Waiting;
	}

	let { waiting }: Props = $props();
</script>

<aside
	class="rounded-[var(--md-sys-shape-corner-medium)] border border-status-warning/45 bg-status-warning-bg px-4 py-3 text-status-warning"
	aria-label="Waiting state"
>
	<p class="font-semibold">Waiting on {waiting.waiting_on ?? 'a dependency'}</p>
	{#if waiting.reason}<p class="mt-1 text-[length:var(--text-body)]">{waiting.reason}</p>{/if}
	{#if waiting.resume_condition}
		<p class="mt-1 text-[length:var(--text-label)]">
			Resume when: {waiting.resume_condition}
		</p>
	{/if}
	{#if waiting.follow_up_at}
		<p class="mt-1 text-[length:var(--text-label)]">
			Follow up: {new Date(waiting.follow_up_at).toLocaleString()}
		</p>
	{/if}
</aside>
