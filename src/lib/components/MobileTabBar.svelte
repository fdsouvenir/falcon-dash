<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { page } from '$app/stores';

	export let totalUnread: number = 0;

	const dispatch = createEventDispatcher<{ more: void }>();

	function handleMoreClick() {
		dispatch('more');
	}

	$: isActive = (path: string, alternates: string[] = []) => {
		if ($page.url.pathname === path) return true;
		return alternates.some((alt) => {
			if (alt.endsWith('*')) {
				return $page.url.pathname.startsWith(alt.slice(0, -1));
			}
			return $page.url.pathname === alt;
		});
	};

	$: chatActive = isActive('/chat', ['/']);
	$: projectsActive = isActive('/projects');
	$: filesActive = isActive('/files');
	$: jobsActive = isActive('/jobs');
	$: moreActive = isActive('/settings', ['/passwords', '/apps/*']);
</script>

<nav class="fixed bottom-0 left-0 right-0 z-30 bg-slate-800 border-t border-slate-700 md:hidden">
	<div class="flex items-center justify-around">
		<!-- Chat Tab -->
		<a
			href="/chat"
			class="flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors {chatActive
				? 'text-blue-400'
				: 'text-slate-400'}"
		>
			<div class="relative">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					/>
				</svg>
				{#if totalUnread > 0}
					<span
						class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-semibold text-white bg-red-500 rounded-full"
					>
						{totalUnread > 99 ? '99+' : totalUnread}
					</span>
				{/if}
			</div>
			<span class="text-xs mt-0.5">Chat</span>
		</a>

		<!-- Projects Tab -->
		<a
			href="/projects"
			class="flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors {projectsActive
				? 'text-blue-400'
				: 'text-slate-400'}"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
				/>
			</svg>
			<span class="text-xs mt-0.5">Projects</span>
		</a>

		<!-- Files Tab -->
		<a
			href="/files"
			class="flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors {filesActive
				? 'text-blue-400'
				: 'text-slate-400'}"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
				/>
			</svg>
			<span class="text-xs mt-0.5">Files</span>
		</a>

		<!-- Jobs Tab -->
		<a
			href="/jobs"
			class="flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors {jobsActive
				? 'text-blue-400'
				: 'text-slate-400'}"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
			<span class="text-xs mt-0.5">Jobs</span>
		</a>

		<!-- More Tab -->
		<button
			type="button"
			on:click={handleMoreClick}
			class="flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors {moreActive
				? 'text-blue-400'
				: 'text-slate-400'}"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
				/>
			</svg>
			<span class="text-xs mt-0.5">More</span>
		</button>
	</div>
</nav>
