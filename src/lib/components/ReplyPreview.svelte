<script lang="ts">
	let {
		message,
		showCancel = false,
		oncancel,
		onclick
	}: {
		message: { id: string; role: string; content: string };
		showCancel?: boolean;
		oncancel?: () => void;
		onclick?: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="flex items-center gap-2 rounded border-l-2 border-blue-500 bg-gray-800/50 px-3 py-1.5 {onclick
		? 'cursor-pointer hover:bg-gray-800'
		: ''}"
	{onclick}
	onkeydown={onclick
		? (e) => {
				if (e.key === 'Enter') onclick?.();
			}
		: undefined}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
>
	<div class="flex-1 truncate text-xs text-gray-400">
		<span class="font-medium text-gray-300">{message.role === 'user' ? 'You' : 'Assistant'}</span>
		<span class="ml-1"
			>{message.content.slice(0, 100)}{message.content.length > 100 ? '...' : ''}</span
		>
	</div>
	{#if showCancel && oncancel}
		<button
			onclick={(e) => {
				e.stopPropagation();
				oncancel?.();
			}}
			class="text-gray-500 hover:text-gray-300"
			aria-label="Cancel reply"
		>
			<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	{/if}
</div>
