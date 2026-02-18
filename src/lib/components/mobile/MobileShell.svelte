<script lang="ts">
	import type { Snippet } from 'svelte';
	import MobileHeader from './MobileHeader.svelte';
	import BottomTabBar from './BottomTabBar.svelte';
	import BottomSheet from './BottomSheet.svelte';
	import MoreSheet from './MoreSheet.svelte';
	import ChatList from '$lib/components/ChatList.svelte';

	let { children }: { children: Snippet } = $props();

	let moreOpen = $state(false);
	let sidebarOpen = $state(false);
</script>

<div class="flex h-screen flex-col bg-gray-950 text-white" style="height: 100dvh">
	<MobileHeader onSidebarOpen={() => (sidebarOpen = true)} />

	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>

	<BottomTabBar onmore={() => (moreOpen = true)} />

	<BottomSheet open={sidebarOpen} onclose={() => (sidebarOpen = false)}>
		<ChatList />
	</BottomSheet>

	<BottomSheet open={moreOpen} onclose={() => (moreOpen = false)}>
		<MoreSheet />
	</BottomSheet>
</div>
