<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import { sessions, loadSessions } from '$lib/stores/sessions.js';

	let { onback }: { onback: () => void } = $props();

	let loading = $state(true);
	let refreshing = $state(false);

	let connectionState = $state('disconnected');
	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	let sessionList = $state<import('$lib/stores/sessions.js').ChatSessionInfo[]>([]);
	$effect(() => {
		const unsub = sessions.subscribe((s) => {
			sessionList = s;
		});
		return unsub;
	});

	type ModelBreakdown = { model: string; tokens: number; sessionCount: number };

	let modelBreakdown = $derived.by(() => {
		const map = new SvelteMap<string, { tokens: number; sessionCount: number }>();
		for (const s of sessionList) {
			const model = s.model || 'unknown';
			const entry = map.get(model) ?? { tokens: 0, sessionCount: 0 };
			entry.tokens += s.totalTokens ?? 0;
			entry.sessionCount++;
			map.set(model, entry);
		}
		return [...map.entries()]
			.map(([model, data]) => ({ model, ...data }))
			.filter((m) => m.tokens > 0)
			.sort((a, b) => b.tokens - a.tokens);
	});

	let totalTokens = $derived(modelBreakdown.reduce((sum, m) => sum + m.tokens, 0));
	let totalSessions = $derived(sessionList.length);

	function modelPercentage(entry: ModelBreakdown): number {
		if (totalTokens === 0) return 0;
		return (entry.tokens / totalTokens) * 100;
	}

	$effect(() => {
		if (connectionState === 'ready') {
			load();
		}
	});

	async function load() {
		loading = true;
		try {
			await loadSessions();
		} finally {
			loading = false;
		}
	}

	async function refresh() {
		refreshing = true;
		try {
			await loadSessions();
		} finally {
			refreshing = false;
		}
	}

	function formatTokens(tokens: number): string {
		if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
		if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
		return tokens.toString();
	}

	const colors = [
		'bg-blue-500',
		'bg-emerald-500',
		'bg-amber-500',
		'bg-violet-500',
		'bg-rose-500',
		'bg-cyan-500',
		'bg-orange-500',
		'bg-teal-500'
	];

	const textColors = [
		'text-blue-400',
		'text-emerald-400',
		'text-amber-400',
		'text-violet-400',
		'text-rose-400',
		'text-cyan-400',
		'text-orange-400',
		'text-teal-400'
	];

	function colorFor(index: number): string {
		return colors[index % colors.length];
	}

	function textColorFor(index: number): string {
		return textColors[index % textColors.length];
	}
</script>

<div class="flex h-full flex-col bg-gray-950">
	<!-- Header -->
	<header class="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
		<button
			onclick={onback}
			class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<h1 class="flex-1 text-base font-semibold text-white">AI Usage</h1>
		<button
			onclick={refresh}
			disabled={refreshing || loading}
			class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
			title="Refresh"
		>
			<svg
				class="h-5 w-5 {refreshing ? 'animate-spin' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
		</button>
	</header>

	<div class="flex-1 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))]">
		{#if loading}
			<!-- Loading skeletons -->
			<div class="mt-4 grid grid-cols-2 gap-3">
				{#each [1, 2] as _i (_i)}
					<div class="animate-pulse rounded-xl border border-gray-800 bg-gray-900 p-4">
						<div class="h-3 w-16 rounded bg-gray-700"></div>
						<div class="mt-3 h-7 w-24 rounded bg-gray-700"></div>
					</div>
				{/each}
			</div>
			<div class="mt-4 animate-pulse rounded-xl border border-gray-800 bg-gray-900 p-4">
				<div class="h-2 w-full rounded-full bg-gray-800"></div>
			</div>
			<div class="mt-3 space-y-3">
				{#each [1, 2, 3] as _i (_i)}
					<div class="animate-pulse rounded-xl border border-gray-800 bg-gray-900 p-4">
						<div class="flex items-center justify-between">
							<div class="h-4 w-24 rounded bg-gray-700"></div>
							<div class="h-4 w-16 rounded bg-gray-700"></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if modelBreakdown.length === 0}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<svg
					class="mb-3 h-10 w-10 text-gray-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
					/>
				</svg>
				<p class="text-sm text-gray-500">No usage data yet</p>
				<p class="mt-1 text-xs text-gray-600">
					Token usage will appear here once you start chatting
				</p>
			</div>
		{:else}
			<!-- Summary cards -->
			<div class="mt-4 grid grid-cols-2 gap-3">
				<div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
					<div class="text-xs font-medium uppercase tracking-wider text-gray-500">Tokens</div>
					<div class="mt-1 font-mono text-2xl font-bold text-white">
						{formatTokens(totalTokens)}
					</div>
				</div>
				<div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
					<div class="text-xs font-medium uppercase tracking-wider text-gray-500">Sessions</div>
					<div class="mt-1 font-mono text-2xl font-bold text-white">
						{totalSessions}
					</div>
				</div>
			</div>

			<p class="mt-3 text-center text-xs text-gray-600">
				Totals reflect active sessions only — deleted sessions are not counted.
			</p>

			<!-- Distribution bar -->
			{#if modelBreakdown.length > 1}
				<div class="mt-4 overflow-hidden rounded-full bg-gray-800">
					<div class="flex h-2">
						{#each modelBreakdown as entry, i (entry.model)}
							<div
								class="{colorFor(i)} {i === 0 ? 'rounded-l-full' : ''} {i ===
								modelBreakdown.length - 1
									? 'rounded-r-full'
									: ''}"
								style="width: {modelPercentage(entry)}%"
							></div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Model breakdown -->
			<div class="mt-4 space-y-2">
				<div class="text-xs font-medium uppercase tracking-wider text-gray-500">By model</div>
				{#each modelBreakdown as entry, i (entry.model)}
					<div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="h-2.5 w-2.5 rounded-full {colorFor(i)}"></span>
								<span class="text-sm font-medium text-white">{entry.model}</span>
							</div>
							{#if modelBreakdown.length > 1}
								<span class="text-xs text-gray-500">
									{modelPercentage(entry).toFixed(0)}%
								</span>
							{/if}
						</div>
						<div class="mt-3 flex items-baseline gap-4">
							<div>
								<span class="font-mono text-lg font-semibold {textColorFor(i)}">
									{formatTokens(entry.tokens)}
								</span>
								<span class="ml-1 text-xs text-gray-500">tokens</span>
							</div>
							<div class="ml-auto">
								<span class="text-xs text-gray-500">
									{entry.sessionCount} session{entry.sessionCount === 1 ? '' : 's'}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
