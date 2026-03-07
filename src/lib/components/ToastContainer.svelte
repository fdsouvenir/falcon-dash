<script lang="ts">
	import { toasts, removeToast, type Toast } from '$lib/stores/toast.js';

	let items = $state<Toast[]>([]);

	$effect(() => {
		const u = toasts.subscribe((v) => {
			items = v;
		});
		return u;
	});

	function typeClasses(type: Toast['type']): string {
		if (type === 'success') return 'border-green-700 bg-green-900/90 text-green-300';
		if (type === 'error') return 'border-red-700 bg-red-900/90 text-red-300';
		return 'border-surface-border bg-surface-2/90 text-white/80';
	}
</script>

{#if items.length > 0}
	<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
		{#each items as toast (toast.id)}
			<div
				class="flex items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg {typeClasses(
					toast.type
				)}"
			>
				<span class="text-xs">{toast.message}</span>
				<button
					onclick={() => removeToast(toast.id)}
					class="ml-2 text-xs opacity-60 hover:opacity-100"
				>
					✕
				</button>
			</div>
		{/each}
	</div>
{/if}
