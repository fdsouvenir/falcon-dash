<script lang="ts">
	interface Props {
		title: string;
		description?: string;
		compact?: boolean;
	}

	let { title, description, compact = false }: Props = $props();
</script>

<div class={compact ? 'py-3' : 'px-4 py-10 text-center'} data-empty-state>
	<p class="font-medium text-on-surface">{title}</p>
	{#if description}
		<p
			class="mx-auto mt-1 max-w-xl text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
		>
			{description}
		</p>
	{/if}
</div>
