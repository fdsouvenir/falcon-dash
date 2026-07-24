<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface FieldContext {
		id: string;
		describedBy: string | undefined;
		invalid: boolean;
		required: boolean;
	}

	interface Props {
		id?: string;
		label: string;
		hint?: string;
		error?: string;
		required?: boolean;
		class?: string;
		children: Snippet<[FieldContext]>;
	}

	let { id, label, hint, error, required = false, class: className, children }: Props = $props();

	const generatedId = $props.id();
	const controlId = $derived(id ?? generatedId);
	const hintId = $derived(hint ? `${controlId}-hint` : undefined);
	const errorId = $derived(error ? `${controlId}-error` : undefined);
	const describedBy = $derived([hintId, errorId].filter(Boolean).join(' ') || undefined);
</script>

<div data-slot="field" class={cn('space-y-1.5', className)}>
	<label
		for={controlId}
		class="block text-[length:var(--md-sys-typescale-label-large-size)] font-medium text-on-surface"
	>
		{label}
		{#if required}<span class="text-status-danger" aria-hidden="true"> *</span>{/if}
	</label>
	{@render children({ id: controlId, describedBy, invalid: Boolean(error), required })}
	{#if hint}
		<p id={hintId} class="text-[length:var(--text-label)] leading-relaxed text-on-surface-variant">
			{hint}
		</p>
	{/if}
	{#if error}
		<p
			id={errorId}
			class="text-[length:var(--text-label)] leading-relaxed text-status-danger"
			role="alert"
		>
			{error}
		</p>
	{/if}
</div>
