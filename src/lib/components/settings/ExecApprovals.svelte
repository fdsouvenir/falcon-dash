<script lang="ts">
	import { call, connection } from '$lib/stores/gateway.js';
	import {
		pendingApprovals as pendingApprovalsStore,
		resolveApproval as resolveApprovalStore,
		denylist,
		addToDenylist,
		removeFromDenylist
	} from '$lib/stores/exec-approvals.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';

	let allowlist = $state<string[]>([]);
	let policy = $state<'off' | 'on-miss' | 'always'>('off');
	let newPattern = $state('');
	let nodes = $state<string[]>([]);
	let selectedNode = $state<string | null>(null);
	let nodeAllowlist = $state<string[]>([]);
	let localPendingApprovals = $state<PendingApproval[]>([]);
	let localDenylist = $state<string[]>([]);
	let newDenyPattern = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let unavailable = $state(false);

	let connectionState = $state('DISCONNECTED');
	$effect(() => {
		const unsub = connection.state.subscribe((s) => {
			connectionState = s;
		});
		return unsub;
	});

	$effect(() => {
		if (connectionState === 'READY') loadAllowlist();
	});

	$effect(() => {
		const unsub = pendingApprovalsStore.subscribe((list) => {
			localPendingApprovals = list;
		});
		return unsub;
	});

	$effect(() => {
		const unsub = denylist.subscribe((list) => {
			localDenylist = list;
		});
		return unsub;
	});

	async function loadAllowlist() {
		loading = true;
		error = null;
		try {
			const result = await call<{ allowlist: string[]; policy: string; nodes: string[] }>(
				'exec.approvals.get',
				{}
			);
			allowlist = result.allowlist || [];
			policy = (result.policy || 'off') as 'off' | 'on-miss' | 'always';
			nodes = result.nodes || [];
			unavailable = false;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			unavailable = true;
		} finally {
			loading = false;
		}
	}

	async function addPattern() {
		if (!newPattern.trim()) return;
		try {
			const updated = [...allowlist, newPattern.trim()];
			await call('exec.approvals.set', { allowlist: updated, policy });
			allowlist = updated;
			newPattern = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function removePattern(pattern: string) {
		try {
			const updated = allowlist.filter((p) => p !== pattern);
			await call('exec.approvals.set', { allowlist: updated, policy });
			allowlist = updated;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function updatePolicy(newPolicy: 'off' | 'on-miss' | 'always') {
		try {
			await call('exec.approvals.set', { allowlist, policy: newPolicy });
			policy = newPolicy;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function loadNodeAllowlist(nodeId: string) {
		try {
			const result = await call<{ allowlist: string[] }>('exec.approvals.node.get', { nodeId });
			nodeAllowlist = result.allowlist || [];
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function updateNodeAllowlist() {
		if (!selectedNode) return;
		try {
			await call('exec.approvals.node.set', { nodeId: selectedNode, allowlist: nodeAllowlist });
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function resolveApproval(
		requestId: string,
		decision: 'allow-once' | 'allow-always' | 'deny'
	) {
		try {
			await resolveApprovalStore(requestId, decision);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	async function alwaysDeny(command: string, requestId: string) {
		try {
			addToDenylist(command);
			await resolveApprovalStore(requestId, 'deny');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	function addDenyPattern() {
		if (!newDenyPattern.trim()) return;
		addToDenylist(newDenyPattern.trim());
		newDenyPattern = '';
	}

	function selectNode(nodeId: string) {
		selectedNode = nodeId;
		loadNodeAllowlist(nodeId);
	}
</script>

<div class="p-6 space-y-6">
	<h2 class="text-2xl font-bold text-gray-100">Exec Approvals</h2>

	<p class="text-sm text-gray-400">
		Exec Approvals control which commands agents can execute. When enabled, agents must request
		approval before running commands not in the allowlist.
	</p>

	{#if unavailable}
		<div class="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
			<p class="text-sm text-yellow-400">
				Exec approvals require the exec-approvals.get gateway method. This feature may not be
				available in all gateway versions.
			</p>
		</div>
	{:else if error}
		<div class="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded">
			{error}
		</div>
	{/if}

	{#if !unavailable}
		<!-- Policy Section -->
		<div class="bg-gray-800 rounded-lg p-4">
			<h3 class="text-lg font-semibold text-gray-100 mb-3">Ask Policy</h3>
			<select
				bind:value={policy}
				onchange={() => updatePolicy(policy)}
				class="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2"
			>
				<option value="off">Off</option>
				<option value="on-miss">On Miss</option>
				<option value="always">Always</option>
			</select>
		</div>

		<!-- Global Allowlist Section -->
		<div class="bg-gray-800 rounded-lg p-4">
			<h3 class="text-lg font-semibold text-gray-100 mb-3">Global Allowlist</h3>

			<div class="flex gap-2 mb-4">
				<input
					type="text"
					bind:value={newPattern}
					placeholder="Command pattern (e.g., ls, git status)"
					class="flex-1 bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2"
					onkeydown={(e) => e.key === 'Enter' && addPattern()}
				/>
				<button
					onclick={addPattern}
					class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
				>
					Add
				</button>
			</div>

			{#if loading}
				<div class="text-gray-400">Loading...</div>
			{:else if allowlist.length === 0}
				<div class="text-gray-400">No patterns in allowlist</div>
			{:else}
				<ul class="space-y-2">
					{#each allowlist as pattern (pattern)}
						<li class="flex justify-between items-center bg-gray-700 px-3 py-2 rounded">
							<code class="text-gray-100">{pattern}</code>
							<button
								onclick={() => removePattern(pattern)}
								class="text-red-400 hover:text-red-300"
							>
								Remove
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Per-Node Allowlist Section -->
		<div class="bg-gray-800 rounded-lg p-4">
			<h3 class="text-lg font-semibold text-gray-100 mb-3">Per-Node Allowlist</h3>

			{#if nodes.length === 0}
				<div class="text-gray-400">No nodes available</div>
			{:else}
				<select
					onchange={(e) => selectNode((e.target as HTMLSelectElement).value)}
					class="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 mb-4"
				>
					<option value="">Select a node</option>
					{#each nodes as node (node)}
						<option value={node}>{node}</option>
					{/each}
				</select>

				{#if selectedNode}
					<div class="space-y-2">
						<textarea
							bind:value={nodeAllowlist}
							placeholder="One pattern per line"
							class="w-full h-32 bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 font-mono text-sm"
						></textarea>
						<button
							onclick={updateNodeAllowlist}
							class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
						>
							Save Node Allowlist
						</button>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Pending Approvals Section -->
		<div class="bg-gray-800 rounded-lg p-4">
			<h3 class="text-lg font-semibold text-gray-100 mb-3">Pending Approvals</h3>

			{#if localPendingApprovals.length === 0}
				<div class="text-gray-400">No pending approvals</div>
			{:else}
				<ul class="space-y-3">
					{#each localPendingApprovals as approval (approval.requestId)}
						<li class="bg-gray-700 p-3 rounded">
							<div class="mb-2">
								<div class="text-gray-100 font-mono text-sm">
									{approval.command}
								</div>
								<div class="text-gray-400 text-xs mt-1">
									Agent: {approval.agentId}
								</div>
							</div>
							<div class="flex gap-2">
								<button
									onclick={() => resolveApproval(approval.requestId, 'allow-once')}
									class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
								>
									Allow Once
								</button>
								<button
									onclick={() => resolveApproval(approval.requestId, 'allow-always')}
									class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
								>
									Allow Always
								</button>
								<button
									onclick={() => resolveApproval(approval.requestId, 'deny')}
									class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
								>
									Deny
								</button>
								<button
									onclick={() => alwaysDeny(approval.command, approval.requestId)}
									class="bg-red-950 hover:bg-red-900 text-red-300 px-3 py-1 rounded text-sm border border-red-800/50"
								>
									Always Deny
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Denylist Section -->
		<div class="bg-gray-800 rounded-lg p-4">
			<h3 class="text-lg font-semibold text-gray-100 mb-3">Denylist</h3>
			<p class="text-sm text-gray-400 mb-4">
				Commands that are automatically denied without prompting.
			</p>

			<div class="flex gap-2 mb-4">
				<input
					type="text"
					bind:value={newDenyPattern}
					placeholder="Command to deny (e.g., rm -rf)"
					class="flex-1 bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2"
					onkeydown={(e) => e.key === 'Enter' && addDenyPattern()}
				/>
				<button
					onclick={addDenyPattern}
					class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
				>
					Add
				</button>
			</div>

			{#if localDenylist.length === 0}
				<div class="text-gray-400">No denied commands</div>
			{:else}
				<ul class="space-y-2">
					{#each localDenylist as command (command)}
						<li class="flex justify-between items-center bg-gray-700 px-3 py-2 rounded">
							<code class="text-gray-100">{command}</code>
							<button
								onclick={() => removeFromDenylist(command)}
								class="text-red-400 hover:text-red-300"
							>
								Remove
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
