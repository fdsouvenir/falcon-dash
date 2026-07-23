<script lang="ts">
	import { onMount } from 'svelte';

	interface TokenRecord {
		id: string;
		agent_id: string;
		label: string;
		created_at: number;
		last_used_at: number | null;
		revoked_at: number | null;
	}

	let tokens = $state<TokenRecord[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let newAgentId = $state('');
	let newLabel = $state('');
	let minting = $state(false);
	let mintedToken = $state<{ token: string; token_file: string; agent_id: string } | null>(null);

	async function refresh(): Promise<void> {
		try {
			const res = await fetch('/api/work3/tokens');
			const data = await res.json();
			tokens = data.tokens ?? [];
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function mint(): Promise<void> {
		if (!newAgentId.trim()) return;
		minting = true;
		error = null;
		try {
			const res = await fetch('/api/work3/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ agent_id: newAgentId.trim(), label: newLabel.trim() || undefined })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Failed to mint token';
				return;
			}
			mintedToken = {
				token: data.token,
				token_file: data.token_file,
				agent_id: data.record.agent_id
			};
			newAgentId = '';
			newLabel = '';
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			minting = false;
		}
	}

	async function revoke(id: string): Promise<void> {
		error = null;
		try {
			const res = await fetch(`/api/work3/tokens/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const data = await res.json();
				error = data.error ?? 'Failed to revoke token';
			}
			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function formatDate(ms: number | null): string {
		if (ms === null) return '—';
		return new Date(ms).toLocaleString();
	}

	onMount(refresh);
</script>

<div class="mx-auto max-w-3xl space-y-6 p-6">
	<div>
		<h2 class="text-lg font-semibold text-white">Agent Tokens</h2>
		<p class="mt-1 text-sm text-status-muted">
			Bearer tokens for the v3 Work API (<code>/api/v3</code>) and the <code>falcon</code> CLI. Tokens
			identify agents — they can never act as a person. Minting a new token for an agent revokes its previous
			one; a token file is dropped under the data directory so the co-resident CLI needs no configuration.
		</p>
	</div>

	{#if error}
		<div class="rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
			{error}
		</div>
	{/if}

	{#if mintedToken}
		<div class="space-y-2 rounded border border-emerald-800 bg-emerald-950/40 p-4">
			<p class="text-sm font-medium text-emerald-300">
				Token minted for <code>{mintedToken.agent_id}</code> — copy it now; it will not be shown again.
			</p>
			<code class="block break-all rounded bg-black/40 p-2 text-xs text-emerald-200"
				>{mintedToken.token}</code
			>
			<p class="text-xs text-status-muted">
				Also written to <code>{mintedToken.token_file}</code> (mode 600).
			</p>
			<button
				class="rounded border border-surface-border px-3 py-1 text-xs text-white/80 hover:bg-surface-2"
				onclick={() => (mintedToken = null)}
			>
				Dismiss
			</button>
		</div>
	{/if}

	<div class="space-y-3 rounded border border-surface-border bg-surface-1 p-4">
		<h3 class="text-sm font-medium text-white">Mint a token</h3>
		<div class="flex flex-wrap items-end gap-3">
			<label class="flex flex-col gap-1 text-xs text-status-muted">
				Agent ID
				<input
					class="rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
					placeholder="main"
					bind:value={newAgentId}
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs text-status-muted">
				Label (optional)
				<input
					class="rounded border border-surface-border bg-surface-2 px-3 py-2 text-sm text-white"
					placeholder="Main agent"
					bind:value={newLabel}
				/>
			</label>
			<button
				class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
				disabled={minting || !newAgentId.trim()}
				onclick={mint}
			>
				{minting ? 'Minting…' : 'Mint token'}
			</button>
		</div>
	</div>

	<div class="rounded border border-surface-border bg-surface-1">
		<div class="border-b border-surface-border px-4 py-2 text-sm font-medium text-white">
			Tokens
		</div>
		{#if loading}
			<p class="px-4 py-3 text-sm text-status-muted">Loading…</p>
		{:else if tokens.length === 0}
			<p class="px-4 py-3 text-sm text-status-muted">No tokens minted yet.</p>
		{:else}
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="text-xs text-status-muted">
						<th class="px-4 py-2 font-medium">Agent</th>
						<th class="px-4 py-2 font-medium">Label</th>
						<th class="px-4 py-2 font-medium">Created</th>
						<th class="px-4 py-2 font-medium">Last used</th>
						<th class="px-4 py-2 font-medium">Status</th>
						<th class="px-4 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each tokens as token (token.id)}
						<tr class="border-t border-surface-border/60">
							<td class="px-4 py-2 text-white"><code>{token.agent_id}</code></td>
							<td class="px-4 py-2 text-white/80">{token.label}</td>
							<td class="px-4 py-2 text-status-muted">{formatDate(token.created_at)}</td>
							<td class="px-4 py-2 text-status-muted">{formatDate(token.last_used_at)}</td>
							<td class="px-4 py-2">
								{#if token.revoked_at}
									<span class="text-red-400">revoked</span>
								{:else}
									<span class="text-emerald-400">active</span>
								{/if}
							</td>
							<td class="px-4 py-2 text-right">
								{#if !token.revoked_at}
									<button
										class="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40"
										onclick={() => revoke(token.id)}
									>
										Revoke
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
