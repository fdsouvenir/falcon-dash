<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	export interface TabItem {
		value: string;
		label: string;
		count?: number;
		disabled?: boolean;
	}

	interface Props {
		items: TabItem[];
		value?: string;
		label?: string;
		class?: string;
		tabClass?: string;
		children: Snippet<[string]>;
	}

	let {
		items,
		value = $bindable(''),
		label = 'Sections',
		class: className,
		tabClass,
		children
	}: Props = $props();

	const generatedId = $props.id();
	const selectedValue = $derived(
		items.some((item) => item.value === value && !item.disabled)
			? value
			: (items.find((item) => !item.disabled)?.value ?? '')
	);

	$effect(() => {
		if (value !== selectedValue) value = selectedValue;
	});

	function tabId(index: number): string {
		return `${generatedId}-tab-${index}`;
	}

	function panelId(index: number): string {
		return `${generatedId}-panel-${index}`;
	}

	function activate(item: TabItem) {
		if (!item.disabled) value = item.value;
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const enabled = items
			.map((item, itemIndex) => ({ item, itemIndex }))
			.filter(({ item }) => !item.disabled);
		if (enabled.length === 0) return;
		const current = enabled.findIndex(({ itemIndex }) => itemIndex === index);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? enabled.length - 1
					: event.key === 'ArrowRight'
						? (current + 1) % enabled.length
						: (current - 1 + enabled.length) % enabled.length;
		const target = enabled[next];
		activate(target.item);
		document.getElementById(tabId(target.itemIndex))?.focus();
	}
</script>

<div data-slot="tabs" class={cn('min-w-0', className)}>
	<div
		role="tablist"
		aria-label={label}
		class="flex min-w-0 gap-1 overflow-x-auto border-b border-outline-variant"
	>
		{#each items as item, index (item.value)}
			<button
				id={tabId(index)}
				type="button"
				role="tab"
				aria-selected={selectedValue === item.value}
				aria-controls={panelId(index)}
				disabled={item.disabled}
				tabindex={selectedValue === item.value ? 0 : -1}
				class={cn(
					'falcon-focus touch-target-inline relative inline-flex shrink-0 items-center gap-2 px-3 py-2 text-[length:var(--md-sys-typescale-label-large-size)] font-semibold text-on-surface-variant transition-[background-color,color] duration-[var(--md-sys-motion-duration-short2)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform aria-selected:bg-surface-container aria-selected:text-on-surface aria-selected:after:scale-x-100 disabled:opacity-40',
					tabClass
				)}
				onclick={() => activate(item)}
				onkeydown={(event) => handleKeydown(event, index)}
			>
				{item.label}
				{#if item.count !== undefined}
					<span
						class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[length:var(--text-badge)]"
					>
						{item.count}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	{#each items as item, index (item.value)}
		<div
			id={panelId(index)}
			role="tabpanel"
			aria-labelledby={tabId(index)}
			hidden={selectedValue !== item.value}
			tabindex="0"
			class="falcon-focus py-4"
		>
			{#if selectedValue === item.value}
				{@render children(item.value)}
			{/if}
		</div>
	{/each}
</div>
