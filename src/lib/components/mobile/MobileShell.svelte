<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileHeader from './MobileHeader.svelte';
	import BottomTabBar from './BottomTabBar.svelte';
	import BottomSheet from './BottomSheet.svelte';
	import MoreSheet from './MoreSheet.svelte';
	import ConnectionErrorBanner from '$lib/components/ConnectionErrorBanner.svelte';
	import MobileNotificationSheet from './MobileNotificationSheet.svelte';
	import ExecApprovalPrompt from '$lib/components/ExecApprovalPrompt.svelte';
	import { pendingApprovals, resolveApproval, addToDenylist } from '$lib/stores/exec-approvals.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';

	let { children }: { children: Snippet } = $props();

	let moreOpen = $state(false);
	let notificationsOpen = $state(false);
	let approvals = $state<PendingApproval[]>([]);
	let approvalsSheetOpen = $derived(approvals.length > 0);

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
</script>

<div class="flex h-screen flex-col bg-gray-950 text-white" style="height: 100dvh">
	<MobileHeader onNotifications={() => (notificationsOpen = true)} />

	<main class="flex-1 overflow-y-auto">
		<ConnectionErrorBanner />
		{@render children()}
	</main>

	<BottomTabBar onmore={() => (moreOpen = true)} />

	<BottomSheet open={moreOpen} onclose={() => (moreOpen = false)}>
		<MoreSheet />
	</BottomSheet>

	<MobileNotificationSheet open={notificationsOpen} onclose={() => (notificationsOpen = false)} />

	<BottomSheet open={approvalsSheetOpen} onclose={() => {}}>
		{#if approvals.length > 0}
			<ExecApprovalPrompt
				approval={approvals[0]}
				pendingCount={approvals.length}
				onResolve={handleResolve}
				onAlwaysDeny={handleAlwaysDeny}
			/>
		{/if}
	</BottomSheet>
</div>
