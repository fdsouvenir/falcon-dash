<script lang="ts">
	import { page } from '$app/stores';
	import { keyboardVisible } from '$lib/stores/viewport.js';
	import { unreadNotificationCount } from '$lib/stores/notifications.js';

	let { onmore, hidden = false }: { onmore: () => void; hidden?: boolean } = $props();

	let pathname = $state('/');
	let kbVisible = $state(false);
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
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
			<span>Chat</span>
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
			href="/passwords"
			class="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs {isActive(
				'/passwords'
			)
				? 'text-blue-400'
				: 'text-gray-500'}"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			<span>Passwords</span>
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
{/if}
