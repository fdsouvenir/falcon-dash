<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import { sessions, activeSessionKey, switchSession, loadSessions } from '$lib/stores/sessions';
	import { sortedCustomApps, reorderApps, unpinApp } from '$lib/stores/apps';
	import { pullToRefresh } from '$lib/utils/gestures';

	async function refreshSessions() {
		await loadSessions();
	}

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

	// Custom apps drag-and-drop reorder state
	let dragIndex: number | null = null;

	function handleDragStart(e: DragEvent, index: number): void {
		dragIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
		}
	}

	function handleDragOver(e: DragEvent): void {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(e: DragEvent, toIndex: number): void {
		e.preventDefault();
		if (dragIndex !== null && dragIndex !== toIndex) {
			reorderApps(dragIndex, toIndex);
		}
		dragIndex = null;
	}

	function handleDragEnd(): void {
		dragIndex = null;
	}

	function handleUnpin(e: MouseEvent, appId: string): void {
		e.preventDefault();
		e.stopPropagation();
		unpinApp(appId);
	}
</script>

<nav aria-label="Sidebar navigation">
	<!-- Logo -->
	<div class="flex h-14 items-center border-b border-slate-700 px-4">
		<span class="text-lg font-semibold text-slate-100">falcon-dash</span>
	</div>

	<!-- Channels section -->
	<div class="flex-1 overflow-y-auto px-3 py-4" use:pullToRefresh={{ onRefresh: refreshSessions }}>
		<div class="mb-2 flex items-center justify-between px-2">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Channels</h3>
			<button
				on:click={handleNewChat}
				class="text-sm text-slate-400 transition-colors hover:text-slate-100"
				aria-label="New chat"
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
							aria-current={$activeSessionKey === session.key ? 'true' : undefined}
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
		<h3 class="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
			Apps
		</h3>
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
						aria-current={isActive(app.href) ? 'page' : undefined}
					>
						{app.label}
					</a>
				</li>
			{/each}
		</ul>

		<!-- Custom Apps section -->
		{#if $sortedCustomApps.length > 0}
			<h3 class="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
				Custom Apps
			</h3>
			<ul class="space-y-1">
				{#each $sortedCustomApps as customApp, i (customApp.id)}
					<li
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, i)}
						on:dragover={handleDragOver}
						on:drop={(e) => handleDrop(e, i)}
						on:dragend={handleDragEnd}
						class="group"
						class:opacity-50={dragIndex === i}
					>
						<a
							href="/apps/{customApp.id}"
							class="flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors"
							class:bg-slate-700={isActive('/apps/' + customApp.id)}
							class:text-slate-100={isActive('/apps/' + customApp.id)}
							class:text-slate-300={!isActive('/apps/' + customApp.id)}
							class:hover:bg-slate-700={!isActive('/apps/' + customApp.id)}
							aria-current={isActive('/apps/' + customApp.id) ? 'page' : undefined}
						>
							<span class="truncate">{customApp.name}</span>
							<button
								on:click={(e) => handleUnpin(e, customApp.id)}
								class="hidden flex-shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-red-400 group-hover:block"
								aria-label="Unpin {customApp.name}"
							>
								<svg
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
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
						aria-current={isActive(link.href) ? 'page' : undefined}
					>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</div>
</nav>
