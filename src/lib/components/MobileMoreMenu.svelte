<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { sortedCustomApps } from '$lib/stores/apps';

	export let open = false;

	const dispatch = createEventDispatcher<{ close: void }>();

	function close() {
		dispatch('close');
	}

	function handleLinkClick() {
		close();
	}

	function handleBackdropClick() {
		close();
	}

	$: currentPath = $page.url.pathname;
</script>

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/50"
		on:click={handleBackdropClick}
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Panel -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
		transition:fly={{ y: 300, duration: 200 }}
	>
		<!-- Drag handle -->
		<div class="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-4"></div>

		<!-- Navigation items -->
		<nav class="space-y-1" aria-label="Additional navigation">
			<!-- Settings -->
			<a
				href="/settings"
				class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-200 hover:bg-slate-700 min-h-[44px] {currentPath ===
				'/settings'
					? 'bg-slate-700 text-slate-100'
					: ''}"
				on:click={handleLinkClick}
			>
				<svg
					class="w-6 h-6"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
				</svg>
				<span class="font-medium">Settings</span>
			</a>

			<!-- Passwords -->
			<a
				href="/passwords"
				class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-200 hover:bg-slate-700 min-h-[44px] {currentPath ===
				'/passwords'
					? 'bg-slate-700 text-slate-100'
					: ''}"
				on:click={handleLinkClick}
			>
				<svg
					class="w-6 h-6"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					></path>
				</svg>
				<span class="font-medium">Passwords</span>
			</a>

			<!-- Custom Apps Section -->
			{#if $sortedCustomApps.length > 0}
				<div class="pt-4 pb-2">
					<div class="flex items-center gap-3 px-4 py-2 text-slate-400 text-sm font-semibold">
						<svg
							class="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
							></path>
						</svg>
						<span>Custom Apps</span>
					</div>
				</div>

				{#each $sortedCustomApps as app (app.id)}
					<a
						href="/apps/{app.id}"
						class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-200 hover:bg-slate-700 min-h-[44px] {currentPath ===
						`/apps/${app.id}`
							? 'bg-slate-700 text-slate-100'
							: ''}"
						on:click={handleLinkClick}
					>
						<svg
							class="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
							></path>
						</svg>
						<span class="font-medium">{app.name}</span>
					</a>
				{/each}
			{/if}
		</nav>
	</div>
{/if}
