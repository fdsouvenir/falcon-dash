<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import FalconModuleShell from '$lib/components/falcon/FalconModuleShell.svelte';
	import { gatewayEvents } from '$lib/gateway-api.js';

	type ModuleStatus = 'active' | 'planned' | 'advanced';

	interface FalconModule {
		id: string;
		label: string;
		description: string;
		primary: boolean;
		status: ModuleStatus;
		routes: string[];
		apiRoutes: string[];
		capabilities: string[];
	}

	interface WorkItem {
		id: number;
		type: string;
		title: string;
		status: string;
		priority: string | null;
		waiting_on: string | null;
		next_action: string | null;
	}

	interface WorkQueue {
		nextActions: WorkItem[];
		waitingOnFred: WorkItem[];
		waitingOnAgent: WorkItem[];
		needsReview: WorkItem[];
		scheduledRoutines: WorkItem[];
		staleCleanup: WorkItem[];
		blockedRisky: WorkItem[];
	}

	let modules = $state<FalconModule[]>([]);
	let queue = $state<WorkQueue | null>(null);
	let health = $state<{ status?: string; version?: string; uptime?: number } | null>(null);
	let ready = $state<{ ready?: boolean } | null>(null);
	let vault = $state<{ available?: boolean; error?: string } | null>(null);
	let gatewayState = $state('disconnected');
	let loading = $state(true);
	let error = $state<string | null>(null);

	const moduleRoutes = {
		shell: '/',
		work: '/work',
		vault: '/passwords',
		channels: '/channels',
		labs: '/settings'
	} as const;

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((state) => {
			gatewayState = state;
		});
		return unsub;
	});

	onMount(() => {
		void loadShell();
	});

	async function loadShell() {
		loading = true;
		error = null;
		try {
			const [modulesRes, healthRes, readyRes, vaultRes, queueRes] = await Promise.all([
				fetch('/api/falcon-dash/modules'),
				fetch('/api/health'),
				fetch('/api/ready'),
				fetch('/api/vault/status'),
				fetch('/api/work/queue')
			]);

			if (!modulesRes.ok) throw new Error(`Modules failed: ${modulesRes.status}`);
			if (!healthRes.ok) throw new Error(`Health failed: ${healthRes.status}`);
			if (!readyRes.ok) throw new Error(`Readiness failed: ${readyRes.status}`);
			if (!queueRes.ok) throw new Error(`Work queue failed: ${queueRes.status}`);

			const modulesJson = await modulesRes.json();
			const healthJson = await healthRes.json();
			const readyJson = await readyRes.json();
			const vaultJson = await vaultRes.json().catch(() => ({ available: false }));
			const queueJson = await queueRes.json();

			modules = modulesJson.modules ?? [];
			health = healthJson;
			ready = readyJson;
			vault = vaultJson;
			queue = queueJson.queue ?? null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load Shell readiness';
		} finally {
			loading = false;
		}
	}

	const primaryModules = $derived(modules.filter((item) => item.primary));
	const openWorkCount = $derived(
		(queue?.nextActions.length ?? 0) +
			(queue?.waitingOnAgent.length ?? 0) +
			(queue?.waitingOnFred.length ?? 0) +
			(queue?.needsReview.length ?? 0) +
			(queue?.blockedRisky.length ?? 0)
	);

	function formatUptime(value: number | undefined): string {
		if (!value) return '--';
		const minutes = Math.floor(value / 60);
		const hours = Math.floor(minutes / 60);
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		return `${minutes}m`;
	}

	function moduleHref(module: FalconModule) {
		return moduleRoutes[module.id as keyof typeof moduleRoutes] ?? '/';
	}

	const readinessChecks = $derived([
		{
			label: 'Gateway event stream',
			detail: gatewayState === 'ready' ? 'Live event stream connected' : 'Reconnect gateway',
			state: gatewayState === 'ready' ? 'healthy' : 'warning'
		},
		{
			label: 'Work database',
			detail: `${openWorkCount} open queue items in active Work DB`,
			state: 'healthy'
		},
		{
			label: 'Vault provider',
			detail: vault?.available ? 'KeePassXC and SecretRef are available' : 'Vault needs attention',
			state: vault?.available ? 'healthy' : 'warning'
		},
		{
			label: 'First-party modules',
			detail: `${primaryModules.length} active modules registered`,
			state: primaryModules.length > 0 ? 'healthy' : 'warning'
		}
	]);

	function statusLabel(state: string): string {
		if (state === 'healthy') return 'Healthy';
		if (state === 'warning') return 'Needs setup';
		return 'Check';
	}
</script>

<svelte:head>
	<title>Shell - Falcon Dash</title>
</svelte:head>

<FalconModuleShell
	active="Shell"
	eyebrow="Falcon Dash / Shell"
	title="Readiness console"
	description="One entry point for the active Falcon Dash product: Work, Vault, Channels, and advanced operator surfaces."
>
	<div class="grid min-h-full gap-px bg-outline-variant/40 p-3 md:grid-cols-[1fr_320px] md:p-4">
		{#if loading}
			<div
				class="border border-outline-variant bg-surface-container p-4 text-sm text-on-surface-variant"
			>
				Loading readiness...
			</div>
		{:else if error}
			<div
				class="border border-status-danger/40 bg-status-danger-bg p-4 text-sm text-status-danger"
			>
				{error}
			</div>
		{:else}
			<div class="min-w-0 space-y-3 md:space-y-4">
				<section class="border border-error-container bg-error-container/10">
					<div
						class="grid gap-4 border-l-4 border-error p-4 md:grid-cols-[1fr_auto] md:items-center"
					>
						<div>
							<h2 class="flex items-center gap-2 text-[18px] font-semibold text-error">
								{gatewayState === 'ready'
									? 'Production channel checks are current'
									: 'Discord is not configured yet'}
							</h2>
							<p class="mt-1 max-w-3xl text-sm leading-5 text-on-surface-variant">
								{gatewayState === 'ready'
									? 'Gateway events, Work DB, Vault provider, and channel surfaces are ready for operator review.'
									: 'The shell needs a valid channel configuration before incoming events can route through the production operator flow.'}
							</p>
						</div>
						<div class="flex flex-wrap gap-2">
							<a
								href={resolve('/channels')}
								class="bg-error px-3 py-2 text-sm font-semibold text-on-error transition hover:opacity-90"
							>
								Set up Discord
							</a>
							<a
								href={resolve('/passwords')}
								class="border border-outline bg-transparent px-3 py-2 text-sm text-on-surface transition hover:bg-surface-variant"
							>
								Open Vault health
							</a>
							<a
								href={resolve('/work')}
								class="border border-outline bg-transparent px-3 py-2 text-sm text-on-surface transition hover:bg-surface-variant"
							>
								Work seed review
							</a>
						</div>
					</div>
				</section>

				<section
					class="overflow-hidden border border-outline-variant bg-outline-variant/40"
					aria-label="Readiness checklist"
				>
					{#each readinessChecks as check (check.label)}
						<div
							class="grid gap-3 border-b border-outline-variant bg-surface-container p-4 last:border-b-0 md:grid-cols-[220px_1fr_132px]"
						>
							<div>
								<p
									class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"
								>
									{check.label}
								</p>
								<p class="mt-1 text-[18px] font-semibold text-primary">
									{statusLabel(check.state)}
								</p>
							</div>
							<p class="text-sm leading-5 text-on-surface-variant md:self-center">{check.detail}</p>
							<span
								class="self-start border px-2 py-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] md:self-center {check.state ===
								'healthy'
									? 'border-status-active text-status-active'
									: 'border-status-warning text-status-warning'}"
							>
								{check.state}
							</span>
						</div>
					{/each}
				</section>

				<section class="grid gap-px bg-outline-variant/40 lg:grid-cols-2">
					<div class="border border-outline-variant bg-surface-container">
						<div class="border-b border-outline-variant bg-surface-container-high px-4 py-3">
							<h2 class="text-sm font-semibold text-primary">First-party modules</h2>
						</div>
						<div class="divide-y divide-outline-variant">
							{#each primaryModules as module (module.id)}
								<a
									href={resolve(moduleHref(module))}
									class="grid gap-3 px-4 py-3 transition hover:bg-surface-container-high md:grid-cols-[8rem_1fr]"
								>
									<div>
										<p class="font-semibold text-primary">{module.label}</p>
										<p
											class="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-status-active"
										>
											{module.status}
										</p>
									</div>
									<div>
										<p class="text-sm leading-5 text-on-surface-variant">{module.description}</p>
										<div class="mt-2 flex flex-wrap gap-1">
											{#each module.capabilities.slice(0, 3) as capability (capability)}
												<span
													class="border border-outline-variant bg-surface-container-high px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant"
												>
													{capability}
												</span>
											{/each}
										</div>
									</div>
								</a>
							{/each}
						</div>
					</div>

					<div class="border border-outline-variant bg-surface-container">
						<div class="border-b border-outline-variant bg-surface-container-high px-4 py-3">
							<h2 class="text-sm font-semibold text-primary">Operator route map</h2>
						</div>
						<div class="grid gap-px bg-outline-variant/40">
							{#each primaryModules as module (module.id)}
								<a
									href={resolve(moduleHref(module))}
									class="grid grid-cols-[1fr_auto] bg-surface-container px-4 py-3 text-sm transition hover:bg-surface-container-high"
								>
									<span class="font-medium text-primary">{module.label}</span>
									<span class="font-mono text-xs text-on-surface-variant">{moduleHref(module)}</span
									>
								</a>
							{/each}
							<a
								href={resolve('/settings')}
								class="grid grid-cols-[1fr_auto] bg-surface-container px-4 py-3 text-sm transition hover:bg-surface-container-high"
							>
								<span class="font-medium text-primary">Labs / Advanced</span>
								<span class="font-mono text-xs text-on-surface-variant">/settings</span>
							</a>
						</div>
					</div>
				</section>
			</div>

			<aside class="min-w-0 border border-outline-variant bg-surface-container">
				<div class="border-b border-outline-variant bg-surface-container-high px-4 py-3">
					<h2 class="text-sm font-semibold text-primary">System status</h2>
				</div>
				<div class="grid gap-px bg-outline-variant/40">
					<div class="bg-surface-container p-4">
						<p
							class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant"
						>
							Service
						</p>
						<p
							class="mt-2 text-2xl font-semibold {ready?.ready
								? 'text-status-active'
								: 'text-error'}"
						>
							{ready?.ready ? 'Ready' : 'Not ready'}
						</p>
						<p class="mt-1 text-xs text-on-surface-variant">Version {health?.version ?? '--'}</p>
					</div>
					<div class="grid grid-cols-2 gap-px">
						<div class="bg-surface-container p-4">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
								Work
							</p>
							<p class="mt-2 text-2xl font-semibold text-primary">{openWorkCount}</p>
							<p class="mt-1 text-xs text-on-surface-variant">Open</p>
						</div>
						<div class="bg-surface-container p-4">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
								Review
							</p>
							<p class="mt-2 text-2xl font-semibold text-primary">
								{queue?.needsReview.length ?? 0}
							</p>
							<p class="mt-1 text-xs text-on-surface-variant">Items</p>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-px">
						<div class="bg-surface-container p-4">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
								Fred
							</p>
							<p class="mt-2 text-2xl font-semibold text-primary">
								{queue?.waitingOnFred.length ?? 0}
							</p>
							<p class="mt-1 text-xs text-on-surface-variant">Waiting</p>
						</div>
						<div class="bg-surface-container p-4">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
								Risk
							</p>
							<p class="mt-2 text-2xl font-semibold text-primary">
								{queue?.blockedRisky.length ?? 0}
							</p>
							<p class="mt-1 text-xs text-on-surface-variant">Blocked</p>
						</div>
					</div>
					<div class="bg-surface-container p-4">
						<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
							Uptime
						</p>
						<p class="mt-2 text-xl font-semibold text-primary">{formatUptime(health?.uptime)}</p>
						<p class="mt-1 text-xs leading-5 text-on-surface-variant">
							Advanced surfaces stay available without being the default workflow.
						</p>
					</div>
				</div>
			</aside>
		{/if}
	</div>
</FalconModuleShell>
