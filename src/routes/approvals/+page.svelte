<script lang="ts">
	import {
		pendingApprovals,
		resolveApproval,
		addToDenylist,
		type PendingApproval
	} from '$lib/stores/exec-approvals.js';
	import { gatewayEvents } from '$lib/gateway-api.js';

	let connectionState = $state('disconnected');
	let approvals = $state<PendingApproval[]>([]);
	let error = $state<string | null>(null);

	$effect(() => {
		const unsub = gatewayEvents.state.subscribe((state) => {
			connectionState = state;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = pendingApprovals.subscribe((value) => {
			approvals = value;
		});
		return unsub;
	});

	async function handleDecision(
		requestId: string,
		decision: 'allow-once' | 'allow-always' | 'deny'
	): Promise<void> {
		try {
			error = null;
			await resolveApproval(requestId, decision);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function handleAlwaysDeny(command: string, requestId: string): Promise<void> {
		try {
			error = null;
			addToDenylist(command);
			await resolveApproval(requestId, 'deny');
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatSession(sessionKey: string): string {
		if (!sessionKey) return 'unknown session';
		const parts = sessionKey.split(':');
		return parts.at(-1) || sessionKey;
	}
</script>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<section
		class="overflow-hidden rounded-3xl border border-surface-border bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] p-5 sm:p-6"
	>
		<p class="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
			Operator Queue
		</p>
		<h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Global approvals</h1>
		<p class="mt-2 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
			Respond to pending exec approvals without hunting through individual chat sessions.
		</p>
		<div class="mt-5 grid gap-3 sm:grid-cols-3">
			<div class="rounded-2xl border border-surface-border bg-surface-1/70 px-4 py-3">
				<p class="text-xs uppercase tracking-[0.18em] text-white/45">Pending</p>
				<p class="mt-1 text-2xl font-semibold text-white">{approvals.length}</p>
			</div>
			<div class="rounded-2xl border border-surface-border bg-surface-1/70 px-4 py-3">
				<p class="text-xs uppercase tracking-[0.18em] text-white/45">Gateway</p>
				<p class="mt-1 text-sm font-medium text-white">
					{connectionState === 'ready' ? 'Connected' : 'Disconnected'}
				</p>
			</div>
			<div class="rounded-2xl border border-surface-border bg-surface-1/70 px-4 py-3">
				<p class="text-xs uppercase tracking-[0.18em] text-white/45">Scope</p>
				<p class="mt-1 text-sm font-medium text-white">All agents and sessions</p>
			</div>
		</div>
	</section>

	{#if error}
		<div
			class="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
		>
			{error}
		</div>
	{/if}

	{#if connectionState !== 'ready'}
		<div class="rounded-2xl border border-surface-border bg-surface-1 px-4 py-10 text-center">
			<p class="text-sm text-status-muted">Connect to the gateway to review approvals.</p>
		</div>
	{:else if approvals.length === 0}
		<div class="rounded-2xl border border-surface-border bg-surface-1 px-4 py-10 text-center">
			<p class="text-base font-medium text-white">No pending approvals</p>
			<p class="mt-2 text-sm text-status-muted">New approval requests will appear here live.</p>
		</div>
	{:else}
		<section class="space-y-4">
			{#each approvals as approval (approval.requestId)}
				<article class="rounded-3xl border border-surface-border bg-surface-2/80 px-5 py-5">
					<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div class="min-w-0 flex-1 space-y-3">
							<div
								class="grid gap-3 text-xs uppercase tracking-[0.18em] text-white/45 sm:grid-cols-3"
							>
								<div>
									<p>Agent</p>
									<p class="mt-1 text-sm font-medium normal-case text-white/80">
										{approval.agentId || 'unknown agent'}
									</p>
								</div>
								<div>
									<p>Session</p>
									<p
										class="mt-1 break-all font-mono text-sm normal-case text-white/80"
										title={approval.sessionKey}
									>
										{formatSession(approval.sessionKey)}
									</p>
								</div>
								<div>
									<p>Requested</p>
									<p class="mt-1 text-sm font-medium normal-case text-white/80">
										{formatTime(approval.timestamp)}
									</p>
								</div>
							</div>
							<p class="break-all font-mono text-sm leading-6 text-white">$ {approval.command}</p>
							<p class="text-sm text-white/60">Request ID: {approval.requestId}</p>
						</div>
						<div class="flex flex-wrap gap-2 lg:w-[22rem] lg:justify-end">
							<button
								onclick={() => handleDecision(approval.requestId, 'allow-once')}
								class="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
								>Allow once</button
							>
							<button
								onclick={() => handleDecision(approval.requestId, 'allow-always')}
								class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
								>Allow always</button
							>
							<button
								onclick={() => handleDecision(approval.requestId, 'deny')}
								class="rounded-full border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/10"
								>Deny</button
							>
							<button
								onclick={() => handleAlwaysDeny(approval.command, approval.requestId)}
								class="rounded-full border border-surface-border px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-surface-1"
								>Always deny</button
							>
						</div>
					</div>
				</article>
			{/each}
		</section>
	{/if}
</div>
