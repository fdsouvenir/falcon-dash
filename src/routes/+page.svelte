<script lang="ts">
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import ChatView from '$lib/components/ChatView.svelte';
	import PresenceList from '$lib/components/PresenceList.svelte';

	let sessionKey = $state<string | null>(null);

	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			sessionKey = v;
		});
		return unsub;
	});
</script>

{#if sessionKey}
	<div class="h-full">
		<ChatView />
	</div>
{:else}
	<div class="flex h-full flex-col items-center px-4 pt-16 md:pt-24">
		<!-- Avatar -->
		<div
			class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600"
		>
			<svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
				/>
			</svg>
		</div>
		<h1 class="mb-1 text-2xl font-bold text-white">How can I help you today?</h1>
		<p class="mb-8 text-sm text-gray-400">Select a chat from the sidebar to get started.</p>

		<!-- Quick-action chips (decorative — no active session to send to) -->
		<div class="mb-10 grid w-full max-w-sm grid-cols-2 gap-2">
			<div
				class="rounded-xl border border-gray-700/50 bg-gray-800/40 px-3 py-3 text-xs text-gray-500"
			>
				Summarize a document
			</div>
			<div
				class="rounded-xl border border-gray-700/50 bg-gray-800/40 px-3 py-3 text-xs text-gray-500"
			>
				Write some code
			</div>
			<div
				class="rounded-xl border border-gray-700/50 bg-gray-800/40 px-3 py-3 text-xs text-gray-500"
			>
				Explain a concept
			</div>
			<div
				class="rounded-xl border border-gray-700/50 bg-gray-800/40 px-3 py-3 text-xs text-gray-500"
			>
				Help me brainstorm
			</div>
		</div>

		<section class="w-full max-w-md">
			<PresenceList />
		</section>
	</div>
{/if}
