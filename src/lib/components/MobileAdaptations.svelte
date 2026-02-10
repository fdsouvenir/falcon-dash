<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		view: 'chat' | 'projects' | 'documents' | 'settings';
		children: Snippet;
	}

	let { view, children }: Props = $props();

	// Detect mobile viewport
	let isMobile = $state(false);

	function checkMobile() {
		isMobile = window.innerWidth < 768;
	}

	$effect(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});
</script>

{#if isMobile}
	<div class="mobile-container h-full overflow-hidden" data-view={view}>
		{#if view === 'chat'}
			<div class="h-full flex flex-col">
				{@render children()}
			</div>
		{:else if view === 'projects'}
			<div class="h-full overflow-y-auto pb-20">
				<div class="kanban-mobile space-y-4 p-4">
					{@render children()}
				</div>
			</div>
		{:else if view === 'documents'}
			<div class="h-full overflow-y-auto pb-20">
				<div class="documents-list p-4">
					{@render children()}
				</div>
			</div>
		{:else if view === 'settings'}
			<div class="fixed inset-0 bg-gray-900 z-50 overflow-y-auto">
				<div class="p-4">
					{@render children()}
				</div>
			</div>
		{/if}
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.mobile-container[data-view='chat'] :global(.sidebar) {
		display: none;
	}

	.mobile-container[data-view='chat'] :global(.conversation-list) {
		width: 100%;
	}

	.mobile-container[data-view='projects'] :global(.kanban-board) {
		flex-direction: column;
	}

	.mobile-container[data-view='projects'] :global(.kanban-column) {
		width: 100%;
		min-height: auto;
	}

	.mobile-container[data-view='projects'] :global(.table-view) {
		display: none;
	}

	.mobile-container[data-view='projects'] :global(.card-view) {
		display: block;
	}

	.mobile-container[data-view='documents'] :global(.document-preview) {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: var(--bg-primary);
	}

	.mobile-container :global(.modal) {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		top: auto;
		border-radius: 1rem 1rem 0 0;
		max-height: 90vh;
		transform: translateY(0);
	}

	.mobile-container :global(.command-palette) {
		position: fixed;
		inset: 0;
		border-radius: 0;
		max-width: 100%;
		max-height: 100%;
	}
</style>
