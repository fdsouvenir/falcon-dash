<script lang="ts">
	import { page } from '$app/stores';
	import * as Sentry from '@sentry/sveltekit';

	const error = $derived($page.error);
	const status = $derived($page.status);

	$effect(() => {
		if (error) {
			Sentry.captureException(error);
		}
	});

	function goHome() {
		window.location.href = '/';
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-900 p-4">
	<div class="w-full max-w-md rounded-lg bg-gray-800 p-8 text-center shadow-xl">
		<div class="mb-4 text-6xl font-bold text-gray-600">{status}</div>
		<h1 class="mb-4 text-xl font-semibold text-white">
			{#if status === 404}
				Page Not Found
			{:else if status === 500}
				Internal Server Error
			{:else}
				Something Went Wrong
			{/if}
		</h1>
		{#if error?.message}
			<p class="mb-6 text-sm text-gray-400">{error.message}</p>
		{/if}
		<button
			onclick={goHome}
			class="inline-block rounded-lg bg-blue-600 px-6 py-2 font-medium hover:bg-blue-700"
		>
			Go Home
		</button>
	</div>
</div>
