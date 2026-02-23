<script lang="ts">
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import NotificationCenter from '$lib/components/NotificationCenter.svelte';
	import ChatList from './ChatList.svelte';
	import { pinnedApps, unpinApp, renameApp } from '$lib/stores/pinned-apps.js';
	import { getAgentIdentity, connectionState } from '$lib/stores/agent-identity.js';

	let {
		collapsed = false,
		onToggle,
		selectedAgentId = 'default'
	}: { collapsed: boolean; onToggle: () => void; selectedAgentId?: string } = $props();

	let agentName = $state('Falcon Dashboard');
	let agentEmoji = $state<string | undefined>(undefined);

	// Fetch identity when selected agent changes
	$effect(() => {
		const id = selectedAgentId;
		const unsub = connectionState.subscribe((s) => {
			if (s !== 'READY') return;
			getAgentIdentity(id).then((identity) => {
				agentName = identity.name || 'Falcon Dashboard';
				agentEmoji = identity.emoji;
			});
		});
		return unsub;
	});

	let editingId = $state<string | null>(null);
	let editName = $state('');
	let confirmingId = $state<string | null>(null);

	function startRename(surfaceId: string, currentName: string) {
		editingId = surfaceId;
		editName = currentName;
		confirmingId = null;
	}

	function commitRename(surfaceId: string) {
		const trimmed = editName.trim();
		if (trimmed) {
			renameApp(surfaceId, trimmed);
		}
		editingId = null;
	}

	function cancelRename() {
		editingId = null;
	}

	function startConfirmRemove(surfaceId: string) {
		confirmingId = surfaceId;
		editingId = null;
	}

	function confirmRemove(surfaceId: string) {
		unpinApp(surfaceId);
		confirmingId = null;
	}

	function cancelRemove() {
		confirmingId = null;
	}

	function handleRenameKeydown(event: KeyboardEvent, surfaceId: string) {
		if (event.key === 'Enter') {
			commitRename(surfaceId);
		} else if (event.key === 'Escape') {
			cancelRename();
		}
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- routes will be created in later stories -->
<aside
	class="flex h-full w-64 flex-col border-r border-gray-800 bg-gray-900 transition-transform duration-200 {collapsed
		? '-translate-x-full'
		: 'translate-x-0'} fixed inset-y-0 left-0 z-40 md:relative md:translate-x-0"
>
	<!-- Header — agent name (Discord-style server header) -->
	<div
		class="flex items-center justify-between border-b border-gray-800 px-4 py-3 shadow-sm shadow-black/20"
	>
		<div class="flex items-center gap-2">
			<ConnectionStatus />
			<span class="text-sm font-semibold text-white"
				>{agentEmoji ? `${agentEmoji} ` : ''}{agentName}</span
			>
			<svg class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.5"
					d="M19 9l-7 7-7-7"
				/>
			</svg>
		</div>
		<button
			class="text-gray-400 hover:text-white md:hidden"
			onclick={onToggle}
			aria-label="Close sidebar"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>

	<!-- Scrollable content -->
	<nav class="flex flex-1 flex-col overflow-y-auto">
		<!-- Channel list (sessions) -->
		<div class="px-3 py-3">
			<ChatList />
		</div>

		<!-- Apps section -->
		<div class="px-3 py-3">
			<h2 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Apps</h2>
			<a
				href="/projects"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
				Projects
			</a>
			<a
				href="/documents"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
					/>
				</svg>
				Documents
			</a>
			<a
				href="/jobs"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				Jobs
			</a>
			<a
				href="/skills"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
					/>
				</svg>
				Skills
			</a>
		</div>

		<!-- Custom Apps section (pinned canvas apps) -->
		{#if $pinnedApps.length > 0}
			<div class="px-3 py-3">
				<h2 class="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
					Custom Apps
				</h2>
				{#each $pinnedApps as app (app.id)}
					{#if confirmingId === app.surfaceId}
						<div class="rounded bg-gray-800 px-2 py-2">
							<p class="mb-2 text-xs text-gray-300">Remove "{app.name}" from sidebar?</p>
							<div class="flex gap-2">
								<button
									class="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900"
									onclick={() => confirmRemove(app.surfaceId)}
								>
									Remove
								</button>
								<button
									class="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-white"
									onclick={cancelRemove}
								>
									Cancel
								</button>
							</div>
						</div>
					{:else if editingId === app.surfaceId}
						<div class="flex items-center gap-1 px-2 py-1">
							<input
								type="text"
								class="flex-1 rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-sm text-white outline-none focus:border-blue-500"
								bind:value={editName}
								onkeydown={(e) => handleRenameKeydown(e, app.surfaceId)}
								onblur={() => commitRename(app.surfaceId)}
								autofocus
							/>
						</div>
					{:else}
						<div class="group flex items-center rounded px-2 py-1.5 hover:bg-gray-800">
							<a
								href="/apps/{app.surfaceId}"
								class="flex flex-1 items-center gap-2 text-sm text-gray-300 hover:text-white"
							>
								<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" />
									<path d="M3 9h18" stroke-width="2" />
									<path d="M9 21V9" stroke-width="2" />
								</svg>
								<span class="truncate">{app.name}</span>
							</a>
							<div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
								<button
									class="rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
									onclick={() => startRename(app.surfaceId, app.name)}
									aria-label="Rename app"
									title="Rename"
								>
									<svg
										class="h-3.5 w-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
								<button
									class="rounded p-0.5 text-gray-500 hover:bg-gray-700 hover:text-red-400"
									onclick={() => startConfirmRemove(app.surfaceId)}
									aria-label="Remove app"
									title="Remove"
								>
									<svg
										class="h-3.5 w-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</nav>

	<!-- Bottom section -->
	<div class="border-t border-gray-800 px-3 py-3">
		<NotificationCenter />
		<a
			href="/settings"
			class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
			Settings
		</a>
		<a
			href="/passwords"
			class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
			Passwords
		</a>
	</div>
</aside>
