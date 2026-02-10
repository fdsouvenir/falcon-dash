<script lang="ts">
	let { type = 'NOTE', children }: { type: string; children: import('svelte').Snippet } = $props();

	const config: Record<
		string,
		{ icon: string; borderColor: string; bgColor: string; textColor: string }
	> = {
		NOTE: {
			icon: 'i',
			borderColor: 'border-blue-600',
			bgColor: 'bg-blue-950',
			textColor: 'text-blue-300'
		},
		TIP: {
			icon: '>',
			borderColor: 'border-green-600',
			bgColor: 'bg-green-950',
			textColor: 'text-green-300'
		},
		WARNING: {
			icon: '!',
			borderColor: 'border-yellow-600',
			bgColor: 'bg-yellow-950',
			textColor: 'text-yellow-300'
		},
		CAUTION: {
			icon: '!!',
			borderColor: 'border-red-600',
			bgColor: 'bg-red-950',
			textColor: 'text-red-300'
		},
		IMPORTANT: {
			icon: '*',
			borderColor: 'border-purple-600',
			bgColor: 'bg-purple-950',
			textColor: 'text-purple-300'
		}
	};

	let style = $derived(config[type.toUpperCase()] ?? config.NOTE);
</script>

<div class="my-3 rounded-lg border-l-4 {style.borderColor} {style.bgColor} p-4">
	<div class="mb-1 flex items-center gap-2">
		<span
			class="flex h-5 w-5 items-center justify-center rounded-full {style.borderColor} {style.textColor} text-xs font-bold"
		>
			{style.icon}
		</span>
		<span class="text-sm font-semibold {style.textColor}">{type.toUpperCase()}</span>
	</div>
	<div class="text-sm text-gray-300">
		{@render children()}
	</div>
</div>
