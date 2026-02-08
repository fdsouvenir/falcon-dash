<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import { sessions, activeSessionKey, switchSession } from '$lib/stores/sessions';

	$: currentPath = $page.url.pathname;
	$: sessionList = [...$sessions.values()];

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	function handleSessionClick(key: string): void {
		switchSession(key);
		goto('/chat');
	}

	function handleNewChat(): void {
		goto('/chat');
	}

	const apps = [
		{ href: '/projects', label: 'Projects' },
		{ href: '/files', label: 'Files' },
		{ href: '/jobs', label: 'Agent Jobs' }
	];

	const bottomLinks = [
		{ href: '/settings', label: 'Settings' },
		{ href: '/passwords', label: 'Passwords' }
	];
</script>

<!-- Logo -->
<div class="flex h-14 items-center border-b border-slate-700 px-4">
	<span class="text-lg font-semibold text-slate-100">falcon-dash</span>
</div>

<!-- Channels section -->
<div class="flex-1 overflow-y-auto px-3 py-4">
	<div class="mb-2 flex items-center justify-between px-2">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Channels</h3>
		<button
			on:click={handleNewChat}
			class="text-sm text-slate-400 transition-colors hover:text-slate-100"
			title="New Chat"
		>
			+
		</button>
	</div>
	<ul class="space-y-1">
		{#if sessionList.length === 0}
			<li>
				<span class="block rounded px-2 py-1.5 text-sm text-slate-400">No channels yet</span>
			</li>
		{:else}
			{#each sessionList as session (session.key)}
				<li>
					<button
						on:click={() => handleSessionClick(session.key)}
						class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors"
						class:bg-slate-700={$activeSessionKey === session.key}
						class:text-slate-100={$activeSessionKey === session.key}
						class:text-slate-300={$activeSessionKey !== session.key}
						class:hover:bg-slate-700={$activeSessionKey !== session.key}
					>
						<span class="truncate">{session.displayName}</span>
						{#if session.unreadCount > 0}
							<span
								class="ml-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white"
							>
								{session.unreadCount}
							</span>
						{/if}
					</button>
				</li>
			{/each}
		{/if}
	</ul>

	<!-- Apps section -->
	<h3 class="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Apps</h3>
	<ul class="space-y-1">
		{#each apps as app (app.href)}
			<li>
				<a
					href={app.href}
					class="block rounded px-2 py-1.5 text-sm transition-colors"
					class:bg-slate-700={isActive(app.href)}
					class:text-slate-100={isActive(app.href)}
					class:text-slate-300={!isActive(app.href)}
					class:hover:bg-slate-700={!isActive(app.href)}
				>
					{app.label}
				</a>
			</li>
		{/each}
	</ul>
</div>

<!-- Sidebar footer -->
<div class="border-t border-slate-700 px-3 py-3">
	<ConnectionStatus />
	<ul class="mt-2 space-y-1">
		{#each bottomLinks as link (link.href)}
			<li>
				<a
					href={link.href}
					class="block rounded px-2 py-1.5 text-sm transition-colors"
					class:bg-slate-700={isActive(link.href)}
					class:text-slate-100={isActive(link.href)}
					class:text-slate-300={!isActive(link.href)}
					class:hover:bg-slate-700={!isActive(link.href)}
				>
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</div>
