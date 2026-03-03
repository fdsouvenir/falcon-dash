<script lang="ts">
	import { untrack } from 'svelte';
	import { gatewayEvents } from '$lib/gateway-api.js';

	interface ActivityItem {
		id: string;
		type: 'lifecycle' | 'discord' | 'health' | 'approval' | 'session' | 'system';
		message: string;
		timestamp: number;
		icon: string;
	}

	const MAX_ITEMS = 20;

	let items = $state<ActivityItem[]>([]);
	let connectionState = $state<string>('disconnected');

	const TYPE_COLOR: Record<string, string> = {
		lifecycle: 'text-status-info',
		discord: 'text-status-purple',
		health: 'text-status-active',
		approval: 'text-status-warning',
		session: 'text-status-purple',
		system: 'text-status-muted'
	};

	const TYPE_TAG_BG: Record<string, string> = {
		lifecycle: 'bg-status-info-bg text-status-info',
		discord: 'bg-status-purple-bg text-status-purple',
		health: 'bg-status-active-bg text-status-active',
		approval: 'bg-status-warning-bg text-status-warning',
		session: 'bg-status-purple-bg text-status-purple',
		system: 'bg-status-muted-bg text-status-muted'
	};

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
			if (s === 'ready') {
				addItem('system', 'Connected to gateway', 'link');
			} else if (s === 'disconnected') {
				addItem('system', 'Disconnected from gateway', 'unlink');
			} else if (s === 'reconnecting') {
				addItem('system', 'Reconnecting...', 'refresh');
			}
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState !== 'ready') return;

		const unsubs = [
			gatewayEvents.on('agent', (payload) => {
				const ts = payload._timestamp as number | undefined;
				const stream = payload.stream as string;
				const phase = (payload.data as Record<string, unknown>)?.phase as string;
				if (stream === 'lifecycle') {
					if (phase === 'start') {
						addItem('lifecycle', 'Agent run started', 'play', ts);
					} else if (phase === 'end') {
						addItem('lifecycle', 'Agent run completed', 'check', ts);
					} else if (phase === 'error') {
						addItem('lifecycle', 'Agent run errored', 'alert', ts);
					}
				}
			}),
			gatewayEvents.on('discord', (payload) => {
				const ts = payload._timestamp as number | undefined;
				const action = payload.action as string;
				if (action === 'connected') {
					addItem('discord', 'Discord bot connected', 'discord', ts);
				} else if (action === 'disconnected') {
					addItem('discord', 'Discord bot disconnected', 'discord', ts);
				}
			}),
			gatewayEvents.on('health', (payload) => {
				const ts = payload._timestamp as number | undefined;
				addItem('health', 'Health status updated', 'heart', ts);
			}),
			gatewayEvents.on('exec.approval.requested', (payload) => {
				const ts = payload._timestamp as number | undefined;
				const cmd = (payload.command as string) ?? 'command';
				addItem('approval', `Approval requested: ${cmd}`, 'shield', ts);
			}),
			gatewayEvents.on('session', (payload) => {
				const ts = payload._timestamp as number | undefined;
				const action = payload.action as string;
				if (action === 'created') {
					addItem('session', 'New session created', 'chat', ts);
				}
			})
		];

		return () => unsubs.forEach((fn) => fn());
	});

	function addItem(type: ActivityItem['type'], message: string, icon: string, timestamp?: number) {
		const item: ActivityItem = {
			id: crypto.randomUUID(),
			type,
			message,
			timestamp: timestamp ?? Date.now(),
			icon
		};
		items = [item, ...untrack(() => items)].slice(0, MAX_ITEMS);
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
</script>

<div class="rounded-lg border border-surface-border bg-surface-2">
	<!-- Header -->
	<div class="flex items-center justify-between px-[var(--space-card-padding)] py-3">
		<h3
			class="text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted"
		>
			Activity
		</h3>
		{#if items.length > 0}
			<button
				onclick={() => (items = [])}
				class="text-[length:var(--text-badge)] text-status-muted/50 transition-colors hover:text-status-muted"
			>
				Clear
			</button>
		{/if}
	</div>

	<!-- Feed -->
	<div class="max-h-72 overflow-y-auto border-t border-surface-border">
		{#if items.length === 0}
			<div
				class="px-[var(--space-card-padding)] py-8 text-center text-[length:var(--text-label)] text-status-muted/50"
			>
				No recent activity
			</div>
		{:else}
			{#each items as item (item.id)}
				<div
					class="flex items-center gap-3 border-b border-surface-border/40 px-[var(--space-card-padding)] py-2 last:border-b-0 transition-colors hover:bg-surface-3/30"
				>
					<!-- Type tag -->
					<span
						class="shrink-0 rounded-full px-[var(--space-badge-x)] py-[var(--space-badge-y)] text-[length:var(--text-badge)] font-semibold {TYPE_TAG_BG[
							item.type
						] ?? 'bg-status-muted-bg text-status-muted'}"
					>
						{item.type}
					</span>

					<!-- Message -->
					<p class="min-w-0 flex-1 truncate text-[length:var(--text-body)] text-white/90">
						{item.message}
					</p>

					<!-- Timestamp -->
					<span class="shrink-0 font-mono text-[length:var(--text-badge)] text-status-muted/60">
						{formatTime(item.timestamp)}
					</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
