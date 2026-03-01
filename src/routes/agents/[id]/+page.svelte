<script lang="ts">
	import { page } from '$app/state';
	import { gatewayEvents } from '$lib/gateway-api.js';
	import { getAgentIdentity, type AgentIdentity } from '$lib/stores/agent-identity.js';
	import {
		agentLifecycle,
		loadAgentLifecycle,
		stopAgent,
		restartGateway,
		type ActiveAgent
	} from '$lib/stores/agent-lifecycle.js';
	import {
		pendingApprovals as pendingApprovalsStore,
		resolveApproval as resolveApprovalStore
	} from '$lib/stores/exec-approvals.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';
	import { discordStatus } from '$lib/stores/discord.js';
	import { addToast } from '$lib/stores/toast.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	let agentId = $derived(page.params.id);

	// Connection state
	let connState = $state('disconnected');

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((s) => {
			connState = s;
			if (s === 'ready') loadData();
		});
		return unsub;
	});

	// Tab management
	type Tab = 'config' | 'lifecycle' | 'channels' | 'approvals';
	let activeTab = $state<Tab>('config');

	// Config tab state
	let identity = $state<AgentIdentity | null>(null);
	let agentConfig = $state<{
		id: string;
		workspace: string;
		identity?: { name?: string; emoji?: string; theme?: string };
	} | null>(null);
	let formTheme = $state('');
	let savingTheme = $state(false);
	let configHash = $state('');

	// Lifecycle tab state
	let activeAgents = $state<ActiveAgent[]>([]);
	let lifecycleLoading = $state(false);
	let stopping = $state(false);
	let restarting = $state(false);

	// Channels tab state
	let discord = $state<{ connected: boolean; guildName?: string }>({ connected: false });

	// Approvals tab state
	let localPendingApprovals = $state<PendingApproval[]>([]);

	$effect(() => {
		const unsub = agentLifecycle.active.subscribe((a) => {
			activeAgents = a;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = agentLifecycle.loading.subscribe((l) => {
			lifecycleLoading = l;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = discordStatus.subscribe((s) => {
			discord = s;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = pendingApprovalsStore.subscribe((list) => {
			localPendingApprovals = list;
		});
		return unsub;
	});

	async function loadData() {
		try {
			const [id, agentsRes] = await Promise.allSettled([
				getAgentIdentity(agentId),
				fetch('/api/agents').then((r) => r.json())
			]);

			if (id.status === 'fulfilled') identity = id.value;
			if (agentsRes.status === 'fulfilled') {
				const match = agentsRes.value.agents?.find((a: { id: string }) => a.id === agentId);
				if (match) {
					agentConfig = match;
					formTheme = match.identity?.theme ?? '';
				}
				configHash = agentsRes.value.hash ?? '';
			}

			await loadAgentLifecycle();
		} catch {
			// Handled by individual stores
		}
	}

	async function saveTheme() {
		savingTheme = true;
		try {
			const res = await fetch(`/api/agents/${agentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ identity: { theme: formTheme }, hash: configHash })
			});
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			configHash = data.hash ?? configHash;
			addToast('Theme updated', 'success');
		} catch (err) {
			addToast(`Failed to update: ${err}`, 'error');
		} finally {
			savingTheme = false;
		}
	}

	async function handleStop(runId: string) {
		stopping = true;
		try {
			await stopAgent(runId);
			addToast('Agent stopped', 'success');
		} catch (err) {
			addToast(`Failed to stop: ${err}`, 'error');
		} finally {
			stopping = false;
		}
	}

	async function handleRestart() {
		restarting = true;
		try {
			await restartGateway();
			addToast('Gateway restarting...', 'success');
		} catch (err) {
			addToast(`Failed to restart: ${err}`, 'error');
		} finally {
			restarting = false;
		}
	}

	async function handleApproval(requestId: string, decision: 'allow-once' | 'deny') {
		resolveApprovalStore(requestId, decision);
	}

	let displayName: string = $derived(
		agentConfig?.identity?.name ?? identity?.name ?? agentId ?? 'Agent'
	);
	let emoji = $derived(agentConfig?.identity?.emoji || identity?.emoji);
	let isConnected = $derived(connState === 'ready');

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'config', label: 'Config' },
		{ id: 'lifecycle', label: 'Lifecycle' },
		{ id: 'channels', label: 'Channels' },
		{ id: 'approvals', label: 'Approvals' }
	];
</script>

<div class="flex flex-col gap-5 p-4 sm:p-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<button
			onclick={() => goto(resolve('/'))}
			class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
			aria-label="Back to dashboard"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<div class="flex items-center gap-2">
			{#if emoji}
				<span class="text-2xl">{emoji}</span>
			{:else}
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700 text-sm font-semibold text-white"
				>
					{displayName.charAt(0).toUpperCase()}
				</div>
			{/if}
			<div>
				<h1 class="text-lg font-semibold text-white">{displayName}</h1>
				<p class="text-xs text-gray-500 font-mono">{agentId}</p>
			</div>
		</div>
	</div>

	{#if !isConnected}
		<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 px-4 py-8 text-center">
			<p class="text-sm text-gray-500">Connect to gateway to manage this agent</p>
		</div>
	{:else}
		<!-- Tab bar -->
		<div class="flex gap-1 border-b border-gray-700/60">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => (activeTab = tab.id)}
					class="px-4 py-2 text-sm font-medium transition-colors {activeTab === tab.id
						? 'border-b-2 border-blue-500 text-white'
						: 'text-gray-400 hover:text-gray-200'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Tab content -->
		<div class="min-h-[300px]">
			{#if activeTab === 'config'}
				<div class="space-y-5">
					<!-- Identity display -->
					<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
						<h3 class="mb-3 text-sm font-semibold text-white">Identity</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-400">Name</span>
								<span class="text-gray-200">{displayName}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-400">Emoji</span>
								<span class="text-gray-200">{emoji || '—'}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-400">Agent ID</span>
								<span class="font-mono text-gray-200">{agentId}</span>
							</div>
							{#if agentConfig?.workspace}
								<div class="flex justify-between">
									<span class="text-gray-400">Workspace</span>
									<span class="font-mono text-xs text-gray-200">{agentConfig.workspace}</span>
								</div>
							{/if}
						</div>
						<p class="mt-3 text-xs text-gray-500">
							Name and emoji are set by the agent itself. Ask the agent in chat to change them.
						</p>
					</div>

					<!-- Theme/role editing -->
					<div class="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
						<h3 class="mb-3 text-sm font-semibold text-white">Role / Theme</h3>
						<p class="mb-2 text-xs text-gray-500">
							Tells other agents what this agent's purpose is.
						</p>
						<textarea
							bind:value={formTheme}
							rows="3"
							placeholder="e.g., Customer support agent for Discord"
							class="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
						></textarea>
						<button
							onclick={saveTheme}
							disabled={savingTheme}
							class="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
						>
							{savingTheme ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
			{:else if activeTab === 'lifecycle'}
				<div class="space-y-5">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold text-white">Active Runs</h3>
						<div class="flex gap-2">
							<button
								onclick={() => loadAgentLifecycle()}
								class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
							>
								Refresh
							</button>
							<button
								onclick={handleRestart}
								disabled={restarting}
								class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
							>
								{restarting ? 'Restarting...' : 'Restart Gateway'}
							</button>
						</div>
					</div>

					{#if lifecycleLoading}
						<div class="flex items-center gap-2 py-4">
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400"
							></div>
							<span class="text-sm text-gray-400">Loading...</span>
						</div>
					{:else if activeAgents.length === 0}
						<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 px-4 py-6 text-center">
							<p class="text-sm text-gray-500">No active runs</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each activeAgents as run (run.runId)}
								<div
									class="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/40 p-3"
								>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
											<span class="text-sm font-medium text-white truncate"
												>{run.task || 'Running'}</span
											>
										</div>
										<div class="mt-1 flex gap-3 text-xs text-gray-500">
											{#if run.model}<span>{run.model}</span>{/if}
											{#if run.tokens}<span>{run.tokens.toLocaleString()} tokens</span>{/if}
											{#if run.startedAt}<span
													>Started {new Date(run.startedAt).toLocaleTimeString()}</span
												>{/if}
										</div>
									</div>
									<button
										onclick={() => handleStop(run.runId)}
										disabled={stopping}
										class="ml-3 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
									>
										Stop
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'channels'}
				<div class="space-y-5">
					<h3 class="text-sm font-semibold text-white">Connected Channels</h3>

					<div class="space-y-3">
						<!-- Discord -->
						<div
							class="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/40 p-3"
						>
							<div class="flex items-center gap-3">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865F2]/20">
									<svg class="h-4 w-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z"
										/>
									</svg>
								</div>
								<div>
									<span class="text-sm font-medium text-gray-200">Discord</span>
									<p class="text-xs {discord.connected ? 'text-emerald-400/80' : 'text-gray-500'}">
										{discord.connected
											? `Connected${discord.guildName ? ` to ${discord.guildName}` : ''}`
											: 'Not connected'}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								{#if discord.connected}
									<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
								{/if}
								<a
									href={resolve('/channels/discord')}
									class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
								>
									{discord.connected ? 'Configure' : 'Set Up'}
								</a>
							</div>
						</div>

						<!-- Telegram -->
						<div
							class="flex items-center justify-between rounded-lg border border-gray-700/60 bg-gray-800/40 p-3"
						>
							<div class="flex items-center gap-3">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
									<svg class="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
										/>
									</svg>
								</div>
								<div>
									<span class="text-sm font-medium text-gray-200">Telegram</span>
									<p class="text-xs text-gray-500">Not configured</p>
								</div>
							</div>
							<a
								href={resolve('/channels/telegram')}
								class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
							>
								Set Up
							</a>
						</div>
					</div>

					<p class="text-xs text-gray-500">
						Manage channel connections from the <a
							href={resolve('/channels')}
							class="text-blue-400 underline">Channels</a
						> page.
					</p>
				</div>
			{:else if activeTab === 'approvals'}
				<div class="space-y-5">
					<h3 class="text-sm font-semibold text-white">Pending Approvals</h3>

					{#if localPendingApprovals.length === 0}
						<div class="rounded-lg border border-gray-700/40 bg-gray-800/20 px-4 py-6 text-center">
							<p class="text-sm text-gray-500">No pending approvals</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each localPendingApprovals as approval (approval.requestId)}
								<div class="rounded-lg border border-amber-600/30 bg-amber-900/10 p-3">
									<div class="mb-2">
										<span class="font-mono text-sm text-gray-200">{approval.command}</span>
									</div>
									<div class="flex gap-2">
										<button
											onclick={() => handleApproval(approval.requestId, 'allow-once')}
											class="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
										>
											Allow
										</button>
										<button
											onclick={() => handleApproval(approval.requestId, 'deny')}
											class="rounded bg-red-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
										>
											Deny
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<p class="text-xs text-gray-500">
						Configure approval policies in <a
							href={resolve('/settings')}
							class="text-blue-400 underline">Settings → Approvals</a
						>.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
