<script lang="ts">
	interface Props {
		/** Canvas host base URL (e.g. http://host:18793/__openclaw__/canvas/) */
		baseUrl?: string;
		/** Canvas path relative to the base URL */
		path?: string;
		/** Optional title for the iframe */
		title?: string;
		onload?: () => void;
		onerror?: (message: string) => void;
	}

	let {
		baseUrl = 'http://127.0.0.1:18793/__openclaw__/canvas/',
		path = '',
		title = 'Canvas App',
		onload,
		onerror
	}: Props = $props();

	let src = $derived(baseUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, ''));

	let loading = $state(true);
	let loadError = $state(false);

	function handleLoad(): void {
		loading = false;
		loadError = false;
		onload?.();
	}

	function handleError(): void {
		loading = false;
		loadError = true;
		onerror?.('Failed to load canvas');
	}
</script>

<div class="relative h-full w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
	{#if loading}
		<div class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
			<div class="flex items-center gap-3 text-slate-400">
				<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
						class="opacity-25"
					/>
					<path
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						class="opacity-75"
					/>
				</svg>
				<span class="text-sm">Loading canvas&hellip;</span>
			</div>
		</div>
	{/if}

	{#if loadError}
		<div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900">
			<svg
				class="h-10 w-10 text-slate-500"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
				/>
			</svg>
			<p class="text-sm text-slate-400">Unable to load canvas</p>
			<p class="text-xs text-slate-500">
				Check that the canvas host is running at {baseUrl}
			</p>
		</div>
	{/if}

	<iframe
		{src}
		{title}
		sandbox="allow-scripts"
		class="h-full w-full border-0"
		onload={handleLoad}
		onerror={handleError}
	/>
</div>
