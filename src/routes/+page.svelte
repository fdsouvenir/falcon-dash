<script lang="ts">
	import PresenceList from '$lib/components/PresenceList.svelte';
</script>

<div class="p-6">
	<h1 class="text-2xl font-bold">Welcome</h1>
	<p class="mt-2 text-gray-400">Select a chat or app from the sidebar to get started.</p>

	<section class="mt-8">
		<PresenceList />
	</section>
</div>
