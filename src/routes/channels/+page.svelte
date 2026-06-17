<script lang="ts">
	import { resolve } from '$app/paths';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import {
		aggregateChatReadiness,
		aggregateChatSummary,
		channelReadinessList,
		channelReadinessLoading,
		startChannelReadiness,
		type ChannelReadiness
	} from '$lib/stores/channel-readiness.js';

	let connectionState = $state('disconnected');
	let channels = $state<ChannelReadiness[]>([]);
	let aggregateState = $state('not_configured');
	let aggregateSummary = $state('No chat channels configured');
	let loading = $state(false);

	const discordChannel = $derived(channels.find((channel) => channel.id === 'discord') ?? null);
	const telegramChannel = $derived(channels.find((channel) => channel.id === 'telegram') ?? null);
	const isConnected = $derived(connectionState === 'ready');

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((state) => {
			connectionState = state;
			if (state === 'ready') startChannelReadiness();
		});
		return unsub;
	});

	$effect(() => {
		const unsub = channelReadinessList.subscribe((value) => {
			channels = value;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = aggregateChatReadiness.subscribe((value) => {
			aggregateState = value;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = aggregateChatSummary.subscribe((value) => {
			aggregateSummary = value;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = channelReadinessLoading.subscribe((value) => {
			loading = value;
		});
		return unsub;
	});

	function stateTone(state: string): string {
		if (state === 'ready') return 'text-status-active border-status-active/40 bg-status-active-bg';
		if (state === 'degraded')
			return 'text-status-warning border-status-warning/40 bg-status-warning-bg';
		if (state === 'misconfigured')
			return 'text-status-danger border-status-danger/40 bg-status-danger-bg';
		if (state === 'needs_input') return 'text-status-info border-status-info/40 bg-status-info-bg';
		return 'text-white/70 border-surface-border bg-surface-2';
	}

	function stateBadge(state: string): string {
		if (state === 'ready') return 'Ready';
		if (state === 'degraded') return 'Degraded';
		if (state === 'misconfigured') return 'Repair';
		if (state === 'needs_input') return 'Needs input';
		return 'Not configured';
	}
</script>

<svelte:head>
	<title>Channels - Falcon Dash</title>
</svelte:head>

<FalconModuleShell
	active="Channels"
	eyebrow="Falcon Dash / Channels"
	title="Channel readiness"
	description="Live chat surface readiness, repair entry points, and provider boundaries for the installed Falcon Dash build."
>
	<div class="space-y-4 p-4 sm:p-5">
		<section class="grid gap-3 md:grid-cols-3">
			<div class="border p-4 {stateTone(aggregateState)}">
				<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">
					Overall
				</p>
				<p class="mt-2 text-xl font-semibold">{stateBadge(aggregateState)}</p>
				<p class="mt-1 text-xs opacity-80">{aggregateSummary}</p>
			</div>
			<div class="border border-surface-border bg-surface-1 p-4">
				<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
					Gateway
				</p>
				<p class="mt-2 text-xl font-semibold text-white">{connectionState}</p>
				<p class="mt-1 text-xs text-status-muted">
					{loading ? 'Refreshing status' : 'Readiness source'}
				</p>
			</div>
			<div class="border border-surface-border bg-surface-1 p-4">
				<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
					Primary
				</p>
				<p class="mt-2 text-xl font-semibold text-white">Discord + WhatsApp</p>
				<p class="mt-1 text-xs text-status-muted">WhatsApp status-only until wired</p>
			</div>
		</section>

		{#if !isConnected}
			<div class="border border-surface-border bg-surface-1 px-4 py-10 text-center">
				<p class="text-sm text-status-muted">
					Connect to the gateway to inspect or repair chat channels.
				</p>
			</div>
		{:else}
			<section class="grid gap-4 xl:grid-cols-2">
				<article class="border border-surface-border bg-surface-1">
					<div
						class="flex items-start justify-between gap-4 border-b border-surface-border px-4 py-3"
					>
						<div>
							<p
								class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted"
							>
								Live provider
							</p>
							<h2 class="mt-1 text-lg font-semibold text-white">Discord</h2>
						</div>
						<span
							class="border px-3 py-1 text-xs font-semibold {stateTone(
								discordChannel?.state ?? ''
							)}"
						>
							{stateBadge(discordChannel?.state ?? '')}
						</span>
					</div>
					<div class="space-y-4 p-4">
						<div>
							<p class="text-sm font-medium text-white">
								{discordChannel?.summary ?? 'Not configured'}
							</p>
							<p class="mt-1 text-sm leading-6 text-white/65">
								{discordChannel?.detail ?? 'Set up Discord for Falcon Dash operator chat.'}
							</p>
						</div>
						<dl class="grid grid-cols-2 gap-px bg-surface-border text-sm">
							<div class="bg-surface-1 p-3">
								<dt class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
									Configured
								</dt>
								<dd class="mt-1 text-white">{discordChannel?.configured ? 'Yes' : 'No'}</dd>
							</div>
							<div class="bg-surface-1 p-3">
								<dt class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
									Running
								</dt>
								<dd class="mt-1 text-white">{discordChannel?.running ? 'Yes' : 'No'}</dd>
							</div>
						</dl>
						<a
							href={resolve('/channels/discord')}
							class="inline-flex border border-white bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
						>
							{discordChannel?.ctaLabel ?? 'Open wizard'}
						</a>
					</div>
				</article>

				<article class="border border-surface-border bg-surface-1">
					<div
						class="flex items-start justify-between gap-4 border-b border-surface-border px-4 py-3"
					>
						<div>
							<p
								class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted"
							>
								Planned provider
							</p>
							<h2 class="mt-1 text-lg font-semibold text-white">WhatsApp</h2>
						</div>
						<span
							class="border border-status-warning/40 bg-status-warning-bg px-3 py-1 text-xs font-semibold text-status-warning"
						>
							Not wired
						</span>
					</div>
					<div class="space-y-4 p-4">
						<p class="text-sm leading-6 text-white/70">
							WhatsApp is part of the approved operator surface, but this Falcon Dash build has no
							route, gateway method, or `wacli` readiness adapter yet.
						</p>
						<div class="grid grid-cols-2 gap-px bg-surface-border text-sm">
							<div class="bg-surface-1 p-3">
								<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
									Configured
								</p>
								<p class="mt-1 text-white">No</p>
							</div>
							<div class="bg-surface-1 p-3">
								<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
									Build scope
								</p>
								<p class="mt-1 text-white">Status-only</p>
							</div>
						</div>
						<p class="text-xs leading-5 text-status-muted">
							Adding real WhatsApp controls should be a separate Change that connects Falcon Dash to
							the local WhatsApp archive/runtime safely.
						</p>
					</div>
				</article>
			</section>

			<section class="border border-surface-border bg-surface-1">
				<div class="border-b border-surface-border px-4 py-3">
					<h2 class="text-sm font-semibold text-white">Advanced provider</h2>
				</div>
				<div class="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
					<div>
						<p class="text-sm font-medium text-white">Telegram</p>
						<p class="mt-1 text-sm leading-6 text-white/65">
							{telegramChannel?.detail ?? 'Telegram remains available as an advanced provider.'}
						</p>
					</div>
					<a
						href={resolve('/channels/telegram')}
						class="inline-flex border border-surface-border bg-surface-2 px-4 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						Open Telegram
					</a>
				</div>
			</section>
		{/if}
	</div>
</FalconModuleShell>
