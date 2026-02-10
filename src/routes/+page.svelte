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
	<div class="p-6">
		<h1 class="text-2xl font-bold">Welcome</h1>
		<p class="mt-2 text-gray-400">Select a chat or app from the sidebar to get started.</p>

		<section class="mt-8">
			<PresenceList />
		</section>
	</div>
{/if}
