<script lang="ts">
	import { eventBus } from '$lib/stores/gateway.js';
	import { connection } from '$lib/stores/gateway.js';
	import type { ConnectionState } from '$lib/gateway/types.js';

	interface ActivityItem {
		id: string;
		type: 'lifecycle' | 'discord' | 'health' | 'approval' | 'session' | 'system';
		message: string;
		timestamp: number;
		icon: string;
	}

	const MAX_ITEMS = 20;

	let items = $state<ActivityItem[]>([]);
	let connectionState = $state<ConnectionState>('DISCONNECTED');

	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
			if (s === 'READY') {
				addItem('system', 'Connected to gateway', 'link');
			} else if (s === 'DISCONNECTED') {
				addItem('system', 'Disconnected from gateway', 'unlink');
			} else if (s === 'RECONNECTING') {
				addItem('system', 'Reconnecting...', 'refresh');
			}
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState !== 'READY') return;

		const unsubs = [
			eventBus.on('agent', (payload) => {
				const stream = payload.stream as string;
				const phase = (payload.data as Record<string, unknown>)?.phase as string;
				if (stream === 'lifecycle') {
					if (phase === 'start') {
						addItem('lifecycle', 'Agent run started', 'play');
					} else if (phase === 'end') {
						addItem('lifecycle', 'Agent run completed', 'check');
					} else if (phase === 'error') {
						addItem('lifecycle', 'Agent run errored', 'alert');
					}
				}
			}),
			eventBus.on('discord', (payload) => {
				const action = payload.action as string;
				if (action === 'connected') {
					addItem('discord', 'Discord bot connected', 'discord');
				} else if (action === 'disconnected') {
					addItem('discord', 'Discord bot disconnected', 'discord');
				}
			}),
			eventBus.on('health', () => {
				addItem('health', 'Health status updated', 'heart');
			}),
			eventBus.on('exec.approval.requested', (payload) => {
				const cmd = (payload.command as string) ?? 'command';
				addItem('approval', `Approval requested: ${cmd}`, 'shield');
			}),
			eventBus.on('session', (payload) => {
				const action = payload.action as string;
				if (action === 'created') {
					addItem('session', 'New session created', 'chat');
				}
			})
		];

		return () => unsubs.forEach((fn) => fn());
	});

	function addItem(type: ActivityItem['type'], message: string, icon: string) {
		const item: ActivityItem = {
			id: crypto.randomUUID(),
			type,
			message,
			timestamp: Date.now(),
			icon
		};
		items = [item, ...items].slice(0, MAX_ITEMS);
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	let typeColor = (type: ActivityItem['type']) => {
		switch (type) {
			case 'lifecycle':
				return 'text-blue-400';
			case 'discord':
				return 'text-indigo-400';
			case 'health':
				return 'text-emerald-400';
			case 'approval':
				return 'text-amber-400';
			case 'session':
				return 'text-purple-400';
			default:
				return 'text-gray-400';
		}
	};
</script>

<div class="rounded-lg border border-gray-700/60 bg-gray-800/40">
	<div class="flex items-center justify-between px-4 py-2.5">
		<h3 class="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Activity</h3>
		{#if items.length > 0}
			<button
				onclick={() => (items = [])}
				class="text-[11px] text-gray-600 transition-colors hover:text-gray-400"
			>
				Clear
			</button>
		{/if}
	</div>
	<div class="max-h-64 overflow-y-auto border-t border-gray-700/40">
		{#if items.length === 0}
			<div class="px-4 py-6 text-center text-xs text-gray-600">No recent activity</div>
		{:else}
			{#each items as item (item.id)}
				<div class="flex items-start gap-2.5 border-b border-gray-700/20 px-4 py-2 last:border-b-0">
					<span class="mt-0.5 flex-shrink-0 {typeColor(item.type)}">
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							{#if item.icon === 'play'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
								/>
							{:else if item.icon === 'check'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							{:else if item.icon === 'alert'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
								/>
							{:else if item.icon === 'shield'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
								/>
							{:else if item.icon === 'heart'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
								/>
							{:else if item.icon === 'link'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.022a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374"
								/>
							{:else if item.icon === 'unlink'}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.364l3.129-3.129M5.636 5.636l12.728 12.728M18.364 5.636a4.5 4.5 0 010 6.364L16.06 14.31"
								/>
							{:else}
								<circle cx="12" cy="12" r="3" />
							{/if}
						</svg>
					</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs text-gray-300">{item.message}</p>
					</div>
					<span class="flex-shrink-0 text-[10px] text-gray-600">{formatTime(item.timestamp)}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
