<script lang="ts">
	import { CollapsibleTrigger } from '$lib/components/ui/collapsible/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';

	type ToolUIPartState =
		| 'input-streaming'
		| 'input-available'
		| 'output-available'
		| 'output-error';

	interface ToolHeaderProps {
		type: string;
		state: ToolUIPartState;
		class?: string;
		durationLabel?: string;
		shellInfo?: string;
		[key: string]: unknown;
	}

	let {
		type,
		state,
		class: className = '',
		durationLabel,
		shellInfo,
		...restProps
	}: ToolHeaderProps = $props();

	let getStatusBadge = $derived.by(() => {
		let labels = {
			'input-streaming': 'Pending',
			'input-available': 'Running',
			'output-available': 'Completed',
			'output-error': 'Error'
		} as const;

		let icons = {
			'input-streaming': CircleIcon,
			'input-available': ClockIcon,
			'output-available': CheckCircleIcon,
			'output-error': XCircleIcon
		} as const;

		let IconComponent = icons[state];
		let label = labels[state];

		return { IconComponent, label };
	});
	let IconComponent = $derived(getStatusBadge.IconComponent);
</script>

<CollapsibleTrigger
	class={cn('flex w-full items-center justify-between gap-4 p-3', className)}
	{...restProps}
>
	<div class="flex items-center gap-2">
		<WrenchIcon class="text-muted-foreground size-4" />
		<span class="text-sm font-medium">{type}</span>
		{#if shellInfo}
			<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{shellInfo}</span>
		{/if}
		<Badge class="gap-1.5 rounded-full text-xs" variant="secondary">
			<IconComponent
				class={cn(
					'size-4',
					state === 'input-available' && 'animate-pulse',
					state === 'output-available' && 'text-green-600',
					state === 'output-error' && 'text-red-600'
				)}
			/>
			{getStatusBadge.label}
		</Badge>
		{#if durationLabel}
			<span class="text-xs text-muted-foreground">{durationLabel}</span>
		{/if}
	</div>
	<ChevronDownIcon
		class="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
	/>
</CollapsibleTrigger>
