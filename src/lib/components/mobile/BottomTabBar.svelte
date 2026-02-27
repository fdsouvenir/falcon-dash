<script lang="ts">
	import { page } from '$app/stores';
	import { keyboardVisible } from '$lib/stores/viewport.js';
	import { pinnedApps } from '$lib/stores/pinned-apps.js';
	import { unreadNotificationCount } from '$lib/stores/notifications.js';

	let { onmore, hidden = false }: { onmore: () => void; hidden?: boolean } = $props();

	let pathname = $state('/');
	let kbVisible = $state(false);
	let hasApps = $state(false);
	let unreadCount = $state(0);

	$effect(() => {
		const unsub = page.subscribe((p) => {
			pathname = p.url.pathname;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = keyboardVisible.subscribe((v) => {
			kbVisible = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = pinnedApps.subscribe((v) => {
			hasApps = v.length > 0;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = unreadNotificationCount.subscribe((v) => {
			unreadCount = v;
		});
		return unsub;
	});

	function isActive(path: string): boolean {
		if (path === '/') return pathname === '/';
		return pathname.startsWith(path);
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->
{#if !kbVisible && !hidden}
	<nav
		class="flex shrink-0 items-stretch border-t border-gray-800 bg-gray-900 pb-[var(--safe-bottom)]"
	>
		<a
			href="/"
			class="touch-target relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
				'/'
			)
				? 'text-blue-400'
				: 'text-gray-500'}"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
				/>
			</svg>
			<span>Home</span>
			{#if unreadCount > 0}
				<span
					class="absolute right-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white"
				>
					{unreadCount > 99 ? '99+' : unreadCount}
				</span>
			{/if}
		</a>

		<a
			href="/projects"
			class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
				'/projects'
			)
				? 'text-blue-400'
				: 'text-gray-500'}"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
			<span>Projects</span>
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
			href="/documents"
			class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
				'/documents'
			)
				? 'text-blue-400'
				: 'text-gray-500'}"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
				/>
			</svg>
			<span>Docs</span>
		</a>

		<a
			href="/channels"
			class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
				'/channels'
			)
				? 'text-blue-400'
				: 'text-gray-500'}"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
				/>
			</svg>
			<span>Channels</span>
		</a>

		{#if hasApps}
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
		{/if}
	</nav>
{/if}
