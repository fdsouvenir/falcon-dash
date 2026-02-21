<script lang="ts">
	import AgentRail from './AgentRail.svelte';
	import Sidebar from './Sidebar.svelte';
	import CanvasBlock from './canvas/CanvasBlock.svelte';
	import ExecApprovalPrompt from './ExecApprovalPrompt.svelte';
	import { canvasStore } from '$lib/stores/gateway.js';
	import { pendingApprovals, resolveApproval, addToDenylist } from '$lib/stores/exec-approvals.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';

	let { children }: { children: import('svelte').Snippet } = $props();
	let sidebarCollapsed = $state(false);
	let selectedAgentId = $state('default');
	let currentSurface = $state<CanvasSurface | null>(null);
	let canvasPanelMinimized = $state(false);
	let approvals = $state<PendingApproval[]>([]);

	$effect(() => {
		const unsub = pendingApprovals.subscribe((v) => {
			approvals = v;
		});
		return unsub;
	});

	function handleResolve(requestId: string, decision: 'allow-once' | 'allow-always' | 'deny') {
		resolveApproval(requestId, decision).catch(() => {});
	}

	function handleAlwaysDeny(requestId: string, command: string) {
		addToDenylist(command);
		resolveApproval(requestId, 'deny').catch(() => {});
	}

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	// Track current canvas surface at the shell level
	$effect(() => {
		const unsub = canvasStore.currentSurface.subscribe((v) => {
			currentSurface = v;
			console.log('[AppShell] currentSurface updated:', v?.surfaceId, 'visible:', v?.visible);
		});
		return unsub;
	});
</script>

<div class="flex h-screen bg-gray-950 text-white">
	<!-- Agent rail — always visible on desktop, hidden on mobile -->
	<div class="hidden md:flex">
		<AgentRail bind:selectedAgentId />
	</div>

	<Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} {selectedAgentId} />

	<!-- Mobile overlay -->
	{#if !sidebarCollapsed}
		<button
			class="fixed inset-0 z-30 bg-black/50 md:hidden"
			onclick={toggleSidebar}
			aria-label="Close sidebar"
		></button>
	{/if}

	<!-- Main content -->
	<main class="flex flex-1 flex-col overflow-hidden">
		<!-- Mobile header with menu button -->
		<header class="flex items-center border-b border-gray-800 px-4 py-2 md:hidden">
			<button
				class="text-gray-400 hover:text-white"
				onclick={toggleSidebar}
				aria-label="Open sidebar"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>
			<span class="ml-3 text-sm font-semibold">Falcon Dashboard</span>
		</header>

		{#if approvals.length > 0}
			<div class="shrink-0 border-b border-gray-800 p-3">
				<ExecApprovalPrompt
					approval={approvals[0]}
					pendingCount={approvals.length}
					onResolve={handleResolve}
					onAlwaysDeny={handleAlwaysDeny}
				/>
			</div>
		{/if}

		<div class="relative flex-1 overflow-y-auto">
			{@render children()}
		</div>

		<!-- Floating canvas panel: visible on ALL pages when a surface is active -->
		{#if currentSurface && currentSurface.visible}
			<div class="canvas-float-panel border-t border-gray-800">
				<div class="flex items-center justify-between px-3 py-1.5">
					<span class="text-xs font-medium text-gray-400">
						Canvas: {currentSurface.title}
					</span>
					<button
						onclick={() => (canvasPanelMinimized = !canvasPanelMinimized)}
						class="text-xs text-gray-500 hover:text-gray-300"
						aria-label={canvasPanelMinimized ? 'Expand canvas' : 'Minimize canvas'}
					>
						{canvasPanelMinimized ? 'Expand' : 'Minimize'}
					</button>
				</div>
				{#if !canvasPanelMinimized}
					<div class="px-4 pb-3">
						<CanvasBlock surfaceId={currentSurface.surfaceId} />
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>
