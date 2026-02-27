<script lang="ts">
	import { page } from '$app/stores';
	import { selectedAgentId } from '$lib/stores/sessions.js';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';
	import { unreadNotificationCount } from '$lib/stores/notifications.js';

	let {
		onNotifications
	}: {
		onNotifications?: () => void;
	} = $props();

	let pathname = $state('/');
	let agentName = $state('Agent');

	$effect(() => {
		const unsub = page.subscribe((p) => {
			pathname = p.url.pathname;
		});
		return unsub;
	});

	let currentAgentId = $state<string | null>(null);

	$effect(() => {
		const unsub = selectedAgentId.subscribe((id) => {
			currentAgentId = id;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'READY') return;
			getAgentIdentity(currentAgentId ?? undefined).then((identity) => {
				agentName = identity.name || 'Agent';
			});
		});
		return unsub;
	});

	const routeTitles: Record<string, string> = {
		'/': 'Dashboard',
		'/settings': 'Settings',
		'/documents': 'Documents',
		'/projects': 'Projects',
		'/channels': 'Channels',
		'/secrets': 'Secrets',
		'/skills': 'Skills'
	};

	let title = $derived(() => {
		if (pathname === '/jobs') return `${agentName}'s Jobs`;
		return routeTitles[pathname] ?? 'Falcon Dashboard';
	});

	let notifCount = $state(0);

	$effect(() => {
		const unsub = unreadNotificationCount.subscribe((v) => {
			notifCount = v;
		});
		return unsub;
	});

	let isSecondaryRoute = $derived(
		['/documents', '/projects', '/channels', '/secrets'].includes(pathname)
	);
</script>

{#snippet notifBell()}
	{#if notifCount > 0}
		<button
			class="touch-target relative flex items-center justify-center text-gray-400 hover:text-white"
			aria-label="Notifications"
			onclick={onNotifications}
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
				/>
			</svg>
			<span
				class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white"
			>
				{notifCount > 99 ? '99+' : notifCount}
			</span>
		</button>
	{/if}
{/snippet}

<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->
<header class="flex shrink-0 items-center border-b border-gray-800 bg-gray-900 px-3 py-2">
	{#if isSecondaryRoute}
		<a
			href="/"
			class="touch-target flex items-center justify-center text-gray-400 hover:text-white"
			aria-label="Back to dashboard"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<span class="flex-1 truncate text-center text-sm font-semibold text-white">{title()}</span>
		{@render notifBell()}
		<a
			href="/settings"
			class="touch-target flex items-center justify-center text-gray-400 hover:text-white"
			aria-label="Settings"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		</a>
	{:else}
		<div class="h-6 w-6"></div>
		<span class="flex-1 truncate text-center text-sm font-semibold text-white">{title()}</span>
		{#if pathname !== '/settings'}
			{@render notifBell()}
			<a
				href="/settings"
				class="touch-target flex items-center justify-center text-gray-400 hover:text-white"
				aria-label="Settings"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</a>
		{:else}
			<div class="h-6 w-6"></div>
		{/if}
	{/if}
</header>
