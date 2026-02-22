<script lang="ts">
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';

	let {
		approval,
		pendingCount,
		onResolve,
		onAlwaysDeny
	}: {
		approval: PendingApproval;
		pendingCount: number;
		onResolve: (requestId: string, decision: 'allow-once' | 'allow-always' | 'deny') => void;
		onAlwaysDeny: (requestId: string, command: string) => void;
	} = $props();

	let commandDisplay = $derived(`$ ${approval.command}`);
</script>

<div class="exec-approval-prompt rounded-lg border border-amber-800/50 bg-gray-900 p-4">
	<!-- Header -->
	<div class="mb-3 flex items-center gap-2">
		<svg
			class="h-5 w-5 shrink-0 text-amber-400"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
		<span class="text-sm font-semibold text-amber-300">Agent wants to run:</span>
		{#if pendingCount > 1}
			<span
				class="ml-auto rounded-full bg-amber-900/60 px-2 py-0.5 text-xs font-medium text-amber-300"
			>
				1 of {pendingCount}
			</span>
		{/if}
	</div>

	<!-- Command -->
	<div class="mb-2 overflow-x-auto rounded-md bg-gray-950 px-3 py-2">
		<code class="whitespace-pre-wrap break-all font-mono text-sm text-green-400">
			{commandDisplay}
		</code>
	</div>

	<!-- Node ID -->
	<p class="mb-4 text-xs text-gray-500">Agent: {approval.agentId}</p>

	<!-- Action buttons -->
	<div class="flex flex-wrap gap-2">
		<button
			onclick={() => onResolve(approval.requestId, 'deny')}
			class="rounded-md bg-red-900/80 px-3 py-1.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-800"
		>
			Deny
		</button>
		<button
			onclick={() => onResolve(approval.requestId, 'allow-once')}
			class="rounded-md bg-green-900/80 px-3 py-1.5 text-sm font-medium text-green-200 transition-colors hover:bg-green-800"
		>
			Allow Once
		</button>
		<button
			onclick={() => onResolve(approval.requestId, 'allow-always')}
			class="rounded-md bg-blue-900/80 px-3 py-1.5 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-800"
		>
			Always Allow
		</button>
		<button
			onclick={() => onAlwaysDeny(approval.requestId, approval.command)}
			class="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-300"
		>
			Always Deny
		</button>
	</div>
</div>

<style>
	@keyframes slide-down {
		from {
			opacity: 0;
			transform: translateY(-1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.exec-approval-prompt {
		animation: slide-down 0.25s ease-out;
	}
</style>
