<script lang="ts">
	import BottomSheet from './BottomSheet.svelte';
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

	let { open, onclose }: { open: boolean; onclose: () => void } = $props();

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

	function handleClick(n: AppNotification) {
		markNotificationRead(n.id);
		if (n.sessionKey) {
			setActiveSession(n.sessionKey);
		}
		onclose();
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

<BottomSheet {open} {onclose} maxHeight="70vh">
	<div class="flex items-center justify-between pb-3">
		<h2 class="text-sm font-semibold text-white">
			Notifications
			{#if unreadCount > 0}
				<span class="ml-1 text-xs font-normal text-gray-400">({unreadCount} unread)</span>
			{/if}
		</h2>
		<div class="flex gap-2">
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

	{#if items.length === 0}
		<div class="py-8 text-center text-sm text-gray-500">No notifications</div>
	{:else}
		<div class="flex flex-col gap-1">
			{#each items as n (n.id)}
				<button
					onclick={() => handleClick(n)}
					class="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left {n.read
						? 'opacity-60'
						: 'bg-gray-800/50'}"
				>
					<svg
						class="mt-0.5 h-5 w-5 shrink-0 {n.read ? 'text-gray-500' : 'text-blue-400'}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={categoryIcon(n.category)} />
					</svg>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<span class="truncate text-sm font-medium {n.read ? 'text-gray-400' : 'text-white'}"
								>{n.title}</span
							>
							<span class="shrink-0 text-xs text-gray-500">{formatRelativeTime(n.timestamp)}</span>
						</div>
						<p class="mt-0.5 text-xs text-gray-400">{n.body}</p>
					</div>
					{#if !n.read}
						<span class="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500"></span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</BottomSheet>
