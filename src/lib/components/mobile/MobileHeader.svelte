<script lang="ts">
	import { page } from '$app/stores';
	import { activeSessionKey, sessions, type ChatSessionInfo } from '$lib/stores/sessions.js';
	import { totalUnreadCount } from '$lib/stores/mobile-chat-nav.js';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';

	let {
		chatOpen = false,
		onBack
	}: {
		chatOpen?: boolean;
		onBack?: () => void;
	} = $props();

	let pathname = $state('/');
	let activeKey = $state<string | null>(null);
	let sessionList = $state<ChatSessionInfo[]>([]);
	let unreadCount = $state(0);
	let agentName = $state('Agent');

	$effect(() => {
		const unsub = page.subscribe((p) => {
			pathname = p.url.pathname;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			activeKey = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = sessions.subscribe((v) => {
			sessionList = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = totalUnreadCount.subscribe((v) => {
			unreadCount = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'CONNECTED') return;
			getAgentIdentity().then((identity) => {
				agentName = identity.name || 'Agent';
			});
		});
		return unsub;
	});

	let isChatRoute = $derived(pathname === '/');

	let sessionName = $derived(() => {
		if (!activeKey) return 'Chat';
		const session = sessionList.find((s) => s.sessionKey === activeKey);
		return session?.displayName ?? 'Chat';
	});

	const routeTitles: Record<string, string> = {
		'/settings': 'Settings',
		'/documents': 'Documents',
		'/projects': 'Projects',
		'/skills': 'Skills',
		'/heartbeat': 'Heartbeat',
		'/passwords': 'Passwords'
	};

	let title = $derived(() => {
		if (isChatRoute && chatOpen) return sessionName();
		if (isChatRoute) return 'Falcon Dash v' + __APP_VERSION__;
		if (pathname === '/jobs') return `${agentName}'s Jobs`;
		return routeTitles[pathname] ?? 'Falcon Dashboard';
	});

	let isSecondaryRoute = $derived(
		['/documents', '/projects', '/skills', '/heartbeat', '/passwords'].includes(pathname)
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static local routes -->
<header class="flex shrink-0 items-center border-b border-gray-800 bg-gray-900 px-3 py-2">
	{#if isChatRoute && chatOpen}
		<!-- Chat route, panel open: back arrow (with unread badge) left, session name center, settings right -->
		<button
			class="touch-target relative flex items-center justify-center text-gray-400 hover:text-white"
			onclick={onBack}
			aria-label="Back to chat list"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			{#if unreadCount > 0}
				<span
					class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
				>
					{unreadCount > 99 ? '99+' : unreadCount}
				</span>
			{/if}
		</button>
		<span class="flex-1 truncate text-center text-sm font-semibold text-white">{title()}</span>
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
	{:else if isChatRoute}
		<!-- Chat route, panel closed: title "Chats", settings gear right -->
		<div class="h-6 w-6"></div>
		<span class="flex-1 truncate text-center text-sm font-semibold text-white">{title()}</span>
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
	{:else if isSecondaryRoute}
		<!-- Secondary route: back arrow left, title center -->
		<a
			href="/"
			class="touch-target flex items-center justify-center text-gray-400 hover:text-white"
			aria-label="Back to chat"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<span class="flex-1 truncate text-center text-sm font-semibold text-white">{title()}</span>
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
		<!-- Primary route (jobs, settings): title center -->
		<div class="h-6 w-6"></div>
		<span class="flex-1 truncate text-center text-sm font-semibold text-white">{title()}</span>
		{#if pathname === '/settings'}
			<div class="h-6 w-6"></div>
		{:else}
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
		{/if}
	{/if}
</header>
