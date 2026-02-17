<script lang="ts">
	import { page } from '$app/stores';

	let { onmore }: { onmore: () => void } = $props();

	let pathname = $state('/');

	$effect(() => {
		const unsub = page.subscribe((p) => {
			pathname = p.url.pathname;
		});
		return unsub;
	});

	function isActive(path: string): boolean {
		if (path === '/') return pathname === '/';
		return pathname.startsWith(path);
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->
<nav
	class="flex shrink-0 items-stretch border-t border-gray-800 bg-gray-900 pb-[var(--safe-bottom)]"
>
	<a
		href="/"
		class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
			'/'
		)
			? 'text-blue-400'
			: 'text-gray-500'}"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
			/>
		</svg>
		<span>Chat</span>
	</a>

	<a
		href="/jobs"
		class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
			'/jobs'
		)
			? 'text-blue-400'
			: 'text-gray-500'}"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		<span>Jobs</span>
	</a>

	<a
		href="/settings"
		class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
			'/settings'
		)
			? 'text-blue-400'
			: 'text-gray-500'}"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
		<span>Settings</span>
	</a>

	<button
		onclick={onmore}
		class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs text-gray-500"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
		</svg>
		<span>More</span>
	</button>
</nav>
