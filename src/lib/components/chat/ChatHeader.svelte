<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Session } from '$lib/gateway/types';

	export let session: Session | undefined = undefined;

	const dispatch = createEventDispatcher<{ settings: void }>();

	$: modelLabel = session?.model || 'Default';
	$: thinkingLevel = session?.thinkingLevel || 'off';
</script>

<div class="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
	{#if session}
		<h2 class="text-sm font-semibold text-slate-200">
			{session.displayName}
		</h2>

		<span class="rounded-full bg-slate-600 px-2 py-0.5 text-xs text-slate-300">
			{modelLabel}
		</span>

		<span
			class="flex-shrink-0 {thinkingLevel === 'stream'
				? 'animate-pulse text-blue-400'
				: thinkingLevel === 'on'
					? 'text-blue-400'
					: 'text-slate-500'}"
			title="Thinking: {thinkingLevel}"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-1.2 2.9A4 4 0 0 1 16 12a4 4 0 0 1-1.5 3.1A3.5 3.5 0 0 1 16 18a3.5 3.5 0 0 1-3.5 3.5H12"
				/>
				<path
					d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0 1.2 2.9A4 4 0 0 0 8 12a4 4 0 0 0 1.5 3.1A3.5 3.5 0 0 0 8 18a3.5 3.5 0 0 0 3.5 3.5H12"
				/>
				<path d="M12 2v20" />
			</svg>
		</span>

		<button
			class="ml-auto cursor-pointer text-slate-400 transition-colors hover:text-slate-200"
			on:click={() => dispatch('settings')}
			title="Session settings"
			aria-label="Session settings"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
				/>
				<circle cx="12" cy="12" r="3" />
			</svg>
		</button>
	{/if}
</div>
