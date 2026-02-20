<script lang="ts">
	import {
		notifications,
		unreadNotificationCount,
		markNotificationRead,
		markAllNotificationsRead,
		clearNotifications,
		type AppNotification
	} from '$lib/stores/notifications.js';
	import { formatRelativeTime } from '$lib/chat/time-utils.js';
	import { setActiveSession } from '$lib/stores/sessions.js';

	let open = $state(false);
	let items = $state<AppNotification[]>([]);
	let unreadCount = $state(0);

	$effect(() => {
		const unsub = notifications.subscribe((v) => {
			items = v;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = unreadNotificationCount.subscribe((v) => {
			unreadCount = v;
		});
		return unsub;
	});

	function toggle() {
		open = !open;
	}

	function handleClickNotification(n: AppNotification) {
		markNotificationRead(n.id);
		if (n.sessionKey) {
			setActiveSession(n.sessionKey);
		}
		open = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.notification-center')) {
			open = false;
		}
	}

	function categoryIcon(category: AppNotification['category']): string {
		switch (category) {
			case 'chat':
				return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
			case 'cron':
				return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
			case 'approval':
				return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
			default:
				return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="notification-center relative">
	<button
		onclick={toggle}
		class="relative flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
		aria-label="Notifications"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
			/>
		</svg>
		Notifications
		{#if unreadCount > 0}
			<span
				class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white"
			>
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-700 px-3 py-2">
				<span class="text-sm font-semibold text-white">Notifications</span>
				<div class="flex gap-1">
					{#if items.length > 0}
						<button
							onclick={markAllNotificationsRead}
							class="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-white"
						>
							Mark all read
						</button>
						<button
							onclick={clearNotifications}
							class="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-white"
						>
							Clear
						</button>
					{/if}
				</div>
			</div>

			<!-- List -->
			<div class="max-h-80 overflow-y-auto">
				{#if items.length === 0}
					<div class="px-3 py-6 text-center text-sm text-gray-500">No notifications</div>
				{:else}
					{#each items as n (n.id)}
						<button
							onclick={() => handleClickNotification(n)}
							class="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-700/50 {n.read
								? 'opacity-60'
								: ''}"
						>
							<svg
								class="mt-0.5 h-4 w-4 shrink-0 {n.read ? 'text-gray-500' : 'text-blue-400'}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={categoryIcon(n.category)} />
							</svg>
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline justify-between gap-2">
									<span
										class="truncate text-xs font-medium {n.read ? 'text-gray-400' : 'text-white'}"
										>{n.title}</span
									>
									<span class="shrink-0 text-[10px] text-gray-500"
										>{formatRelativeTime(n.timestamp)}</span
									>
								</div>
								<p class="truncate text-xs text-gray-400">{n.body}</p>
							</div>
							{#if !n.read}
								<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"></span>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
