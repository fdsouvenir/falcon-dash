<script lang="ts">
	import { Monitor, Tablet, Smartphone, X, ExternalLink, AlertTriangle } from '@lucide/svelte';

	let { url, onclose }: { url: string; onclose?: () => void } = $props();

	type SizeMode = 'desktop' | 'tablet' | 'mobile';

	let sizeMode: SizeMode = $state('desktop');
	let loading = $state(true);
	let error = $state(false);

	const sizes: Record<SizeMode, { width: string; label: string }> = {
		desktop: { width: '100%', label: 'Desktop' },
		tablet: { width: '768px', label: 'Tablet' },
		mobile: { width: '375px', label: 'Mobile' }
	};

	function handleLoad() {
		loading = false;
		error = false;
	}

	function handleError() {
		loading = false;
		error = true;
	}

	function openExternal() {
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	let hostname = $derived(() => {
		try {
			return new URL(url).hostname;
		} catch {
			return url;
		}
	});
</script>

<div class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
	<!-- Toolbar -->
	<div class="flex items-center gap-2 border-b border-gray-700 bg-gray-800/80 px-3 py-2">
		<!-- Size mode toggles -->
		<div class="flex items-center gap-0.5 rounded-lg border border-gray-700 bg-gray-900/50 p-0.5">
			<button
				onclick={() => (sizeMode = 'desktop')}
				class="rounded-md p-1.5 transition-colors {sizeMode === 'desktop'
					? 'bg-gray-700 text-white'
					: 'text-gray-400 hover:text-gray-200'}"
				title="Desktop"
			>
				<Monitor class="h-3.5 w-3.5" />
			</button>
			<button
				onclick={() => (sizeMode = 'tablet')}
				class="rounded-md p-1.5 transition-colors {sizeMode === 'tablet'
					? 'bg-gray-700 text-white'
					: 'text-gray-400 hover:text-gray-200'}"
				title="Tablet"
			>
				<Tablet class="h-3.5 w-3.5" />
			</button>
			<button
				onclick={() => (sizeMode = 'mobile')}
				class="rounded-md p-1.5 transition-colors {sizeMode === 'mobile'
					? 'bg-gray-700 text-white'
					: 'text-gray-400 hover:text-gray-200'}"
				title="Mobile"
			>
				<Smartphone class="h-3.5 w-3.5" />
			</button>
		</div>

		<!-- URL bar -->
		<div
			class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-1.5"
		>
			<span class="truncate text-xs text-gray-400">{hostname()}</span>
		</div>

		<!-- External link -->
		<button
			onclick={openExternal}
			class="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
			title="Open in new tab"
		>
			<ExternalLink class="h-3.5 w-3.5" />
		</button>

		<!-- Close -->
		{#if onclose}
			<button
				onclick={onclose}
				class="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
				title="Close preview"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}
	</div>

	<!-- Content area -->
	<div class="relative flex flex-1 items-start justify-center overflow-auto bg-gray-950 p-4">
		{#if error}
			<!-- Error state -->
			<div class="flex flex-col items-center gap-3 pt-20 text-center">
				<div class="rounded-full bg-red-900/30 p-3">
					<AlertTriangle class="h-6 w-6 text-red-400" />
				</div>
				<p class="text-sm font-medium text-gray-300">Failed to load page</p>
				<p class="max-w-xs text-xs text-gray-500">
					The page at <span class="text-gray-400">{hostname()}</span> could not be loaded. It may block
					embedding.
				</p>
				<button
					onclick={openExternal}
					class="mt-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-700"
				>
					Open in new tab
				</button>
			</div>
		{/if}

		<!-- Loading shimmer -->
		{#if loading && !error}
			<div class="absolute inset-0 flex flex-col gap-3 p-6">
				<div class="shimmer h-8 w-3/4 rounded-lg bg-gray-800"></div>
				<div class="shimmer h-4 w-full rounded bg-gray-800" style="animation-delay: 100ms"></div>
				<div class="shimmer h-4 w-5/6 rounded bg-gray-800" style="animation-delay: 200ms"></div>
				<div class="shimmer h-4 w-4/6 rounded bg-gray-800" style="animation-delay: 300ms"></div>
				<div
					class="shimmer mt-4 h-40 w-full rounded-lg bg-gray-800"
					style="animation-delay: 400ms"
				></div>
				<div class="shimmer h-4 w-full rounded bg-gray-800" style="animation-delay: 500ms"></div>
				<div class="shimmer h-4 w-3/4 rounded bg-gray-800" style="animation-delay: 600ms"></div>
			</div>
		{/if}

		<!-- Iframe -->
		<iframe
			src={url}
			title="Web preview"
			class="h-full rounded-lg border border-gray-800 bg-white transition-[width] duration-300 ease-in-out"
			class:opacity-0={loading || error}
			style="width: {sizes[sizeMode].width}; max-width: 100%"
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			onload={handleLoad}
			onerror={handleError}
		></iframe>
	</div>
</div>

<style>
	@keyframes shimmer {
		0% {
			opacity: 0.3;
		}
		50% {
			opacity: 0.6;
		}
		100% {
			opacity: 0.3;
		}
	}

	.shimmer {
		animation: shimmer 1.5s ease-in-out infinite;
	}
</style>
