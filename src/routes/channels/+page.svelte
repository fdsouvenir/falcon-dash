<script lang="ts">
	import {
		aggregateChatReadiness,
		aggregateChatSummary,
		channelReadinessList,
		channelReadinessLoading,
		startChannelReadiness,
		type ChannelReadiness
	} from '$lib/stores/channel-readiness.js';
	import { gatewayEvents } from '$lib/gateway-api.js';

	let connectionState = $state('disconnected');
	let channels = $state<ChannelReadiness[]>([]);
	let aggregateState = $state('not_configured');
	let aggregateSummary = $state('No chat channels configured');
	let loading = $state(false);

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

	let isConnected = $derived(connectionState === 'ready');

	function stateTone(state: string): string {
		if (state === 'ready') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
		if (state === 'degraded') return 'text-amber-200 border-amber-500/30 bg-amber-500/10';
		if (state === 'misconfigured') return 'text-rose-200 border-rose-500/30 bg-rose-500/10';
		if (state === 'needs_input') return 'text-sky-200 border-sky-500/30 bg-sky-500/10';
		return 'text-white/70 border-surface-border bg-surface-2/70';
	}

	function stateBadge(state: string): string {
		if (state === 'ready') return 'Ready';
		if (state === 'degraded') return 'Degraded';
		if (state === 'misconfigured') return 'Repair';
		if (state === 'needs_input') return 'Needs Input';
		return 'Not Configured';
	}
</script>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<section
		class="overflow-hidden rounded-3xl border border-surface-border bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] p-5 sm:p-6"
	>
		<div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-2xl space-y-3">
				<p class="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/80">
					Chat Readiness
				</p>
				<h1 class="text-2xl font-semibold text-white sm:text-3xl">
					Channel setup, repair, and live status in one place
				</h1>
				<p class="max-w-xl text-sm leading-6 text-white/70 sm:text-base">
					Falcon Dash treats chat as operator infrastructure. At least one supported channel must be
					healthy for chat to be ready.
				</p>
			</div>
			<div
				class="rounded-2xl border px-4 py-3 backdrop-blur-sm {stateTone(
					aggregateState
				)} lg:min-w-72"
			>
				<p class="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Overall</p>
				<div class="mt-1 flex items-center gap-2">
					<span class="text-lg font-semibold">{stateBadge(aggregateState)}</span>
					{#if loading}
						<span class="text-xs opacity-75">Refreshing…</span>
					{/if}
				</div>
				<p class="mt-1 text-sm opacity-90">{aggregateSummary}</p>
			</div>
		</div>
	</section>

	{#if !isConnected}
		<div class="rounded-2xl border border-surface-border bg-surface-1 px-4 py-10 text-center">
			<p class="text-sm text-status-muted">
				Connect to the gateway to inspect or repair chat channels.
			</p>
		</div>
	{:else}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- shared readiness cards link to known local wizard routes -->
		<section class="grid gap-4 lg:grid-cols-2">
			{#each channels as channel (channel.id)}
				<article class="overflow-hidden rounded-3xl border border-surface-border bg-surface-2/80">
					<div
						class="flex items-start justify-between gap-4 border-b border-surface-border/70 px-5 py-4"
					>
						<div>
							<p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
								{channel.id}
							</p>
							<h2 class="mt-1 text-xl font-semibold text-white">{channel.label}</h2>
						</div>
						<span
							class="rounded-full border px-3 py-1 text-xs font-semibold {stateTone(channel.state)}"
							>{stateBadge(channel.state)}</span
						>
					</div>
					<div class="space-y-5 px-5 py-5">
						<div>
							<p class="text-base font-medium text-white">{channel.summary}</p>
							<p class="mt-1 text-sm leading-6 text-white/65">{channel.detail}</p>
						</div>
						<dl class="grid grid-cols-2 gap-3 text-sm text-white/70">
							<div class="rounded-2xl bg-surface-1/70 px-3 py-3">
								<dt class="text-xs uppercase tracking-[0.18em] text-white/40">Configured</dt>
								<dd class="mt-1 font-medium text-white">{channel.configured ? 'Yes' : 'No'}</dd>
							</div>
							<div class="rounded-2xl bg-surface-1/70 px-3 py-3">
								<dt class="text-xs uppercase tracking-[0.18em] text-white/40">Running</dt>
								<dd class="mt-1 font-medium text-white">{channel.running ? 'Yes' : 'No'}</dd>
							</div>
						</dl>
						<div class="flex items-center justify-between gap-3">
							<a
								href={channel.href}
								class="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
							>
								{channel.ctaLabel}
							</a>
							<p class="text-xs uppercase tracking-[0.18em] text-white/40">
								Shared readiness model
							</p>
						</div>
					</div>
				</article>
			{/each}
		</section>
	{/if}
</div>
