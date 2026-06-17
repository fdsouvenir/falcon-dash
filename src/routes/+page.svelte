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

	function toneFor(value: 'ready' | 'warn' | 'muted' | 'danger'): string {
		if (value === 'ready') return 'border-status-active/40 bg-status-active-bg text-status-active';
		if (value === 'warn')
			return 'border-status-warning/40 bg-status-warning-bg text-status-warning';
		if (value === 'danger') return 'border-status-danger/40 bg-status-danger-bg text-status-danger';
		return 'border-surface-border bg-surface-2 text-white/70';
	}

	function moduleHref(module: FalconModule) {
		return moduleRoutes[module.id as keyof typeof moduleRoutes] ?? '/';
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
	<div class="space-y-4 p-4 sm:p-5">
		{#if loading}
			<div class="border border-surface-border bg-surface-1 p-4 text-sm text-status-muted">
				Loading readiness...
			</div>
		{:else if error}
			<div
				class="border border-status-danger/40 bg-status-danger-bg p-4 text-sm text-status-danger"
			>
				{error}
			</div>
		{:else}
			<section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div class="border p-4 {toneFor(ready?.ready ? 'ready' : 'danger')}">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
						Service
					</p>
					<p class="mt-2 text-xl font-semibold">{ready?.ready ? 'Ready' : 'Not ready'}</p>
					<p class="mt-1 text-xs opacity-80">Version {health?.version ?? '--'}</p>
				</div>
				<div class="border p-4 {toneFor(gatewayState === 'ready' ? 'ready' : 'warn')}">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
						Gateway
					</p>
					<p class="mt-2 text-xl font-semibold">{gatewayState}</p>
					<p class="mt-1 text-xs opacity-80">Live event stream</p>
				</div>
				<div class="border p-4 {toneFor(vault?.available ? 'ready' : 'warn')}">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
						Vault
					</p>
					<p class="mt-2 text-xl font-semibold">{vault?.available ? 'Available' : 'Check vault'}</p>
					<p class="mt-1 text-xs opacity-80">KeePassXC / SecretRef</p>
				</div>
				<div class="border border-surface-border bg-surface-1 p-4">
					<p class="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-status-muted">
						Work
					</p>
					<p class="mt-2 text-xl font-semibold text-white">{openWorkCount}</p>
					<p class="mt-1 text-xs text-status-muted">Open queue items</p>
				</div>
			</section>

			<section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
				<div class="border border-surface-border bg-surface-1">
					<div class="border-b border-surface-border px-4 py-3">
						<h2 class="text-sm font-semibold text-white">First-party modules</h2>
					</div>
					<div class="divide-y divide-surface-border">
						{#each primaryModules as module (module.id)}
							<a
								href={resolve(moduleHref(module))}
								class="grid gap-3 px-4 py-3 transition hover:bg-surface-2 md:grid-cols-[10rem_1fr_auto]"
							>
								<div>
									<p class="font-semibold text-white">{module.label}</p>
									<p
										class="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-status-active"
									>
										{module.status}
									</p>
								</div>
								<p class="text-sm leading-5 text-white/70">{module.description}</p>
								<div class="flex flex-wrap gap-1 md:justify-end">
									{#each module.capabilities.slice(0, 3) as capability (capability)}
										<span
											class="border border-surface-border bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60"
										>
											{capability}
										</span>
									{/each}
								</div>
							</a>
						{/each}
					</div>
				</div>

				<div class="border border-surface-border bg-surface-1">
					<div class="border-b border-surface-border px-4 py-3">
						<h2 class="text-sm font-semibold text-white">Queue pressure</h2>
					</div>
					<div class="grid grid-cols-2 gap-px bg-surface-border">
						<div class="bg-surface-1 p-3">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
								Next
							</p>
							<p class="mt-2 text-2xl font-semibold text-white">{queue?.nextActions.length ?? 0}</p>
						</div>
						<div class="bg-surface-1 p-3">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
								Review
							</p>
							<p class="mt-2 text-2xl font-semibold text-white">{queue?.needsReview.length ?? 0}</p>
						</div>
						<div class="bg-surface-1 p-3">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
								Fred
							</p>
							<p class="mt-2 text-2xl font-semibold text-white">
								{queue?.waitingOnFred.length ?? 0}
							</p>
						</div>
						<div class="bg-surface-1 p-3">
							<p class="font-mono text-[10px] uppercase tracking-[0.16em] text-status-muted">
								Risk
							</p>
							<p class="mt-2 text-2xl font-semibold text-white">
								{queue?.blockedRisky.length ?? 0}
							</p>
						</div>
					</div>
					<div class="border-t border-surface-border px-4 py-3 text-xs text-status-muted">
						Uptime {formatUptime(health?.uptime)}. Advanced surfaces stay available without being
						the default workflow.
					</div>
				</div>
			</section>

			<section class="border border-surface-border bg-surface-1">
				<div class="border-b border-surface-border px-4 py-3">
					<h2 class="text-sm font-semibold text-white">Labs / Advanced</h2>
				</div>
				<div class="flex flex-wrap gap-2 p-4">
					<a
						href={resolve('/apps')}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						apps
					</a>
					<a
						href={resolve('/approvals')}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						approvals
					</a>
					<a
						href={resolve('/jobs')}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						jobs
					</a>
					<a
						href={resolve('/documents')}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						documents
					</a>
					<a
						href={resolve('/settings')}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						settings
					</a>
					<a
						href={resolve('/skills')}
						class="border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white/75 hover:border-white/40 hover:text-white"
					>
						skills
					</a>
				</div>
			</section>
		{/if}
	</div>
</FalconModuleShell>
