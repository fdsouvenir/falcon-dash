<script lang="ts">
	import { onMount } from 'svelte';
	import { ensureA2UILoaded, type A2UIHostElement } from '$lib/canvas/a2ui-bridge.js';

	interface Props {
		messages: unknown[];
	}

	let { messages = $bindable() }: Props = $props();

	let hostElement: A2UIHostElement | null = $state(null);
	let a2uiReady = $state(false);

	onMount(async () => {
		try {
			// 3-tier loading: local bundle → canvas host → placeholder
			// No host/port needed — a2ui-bridge handles derivation internally
			await ensureA2UILoaded();
			a2uiReady = true;
			console.log('[InlineA2UI] A2UI ready, messages:', messages.length);
			if (hostElement) {
				hostElement.applyMessages(messages);
			}
		} catch (err) {
			console.error('[InlineA2UI] Failed to load A2UI bundle:', err);
			a2uiReady = false;
		}
	});

	$effect(() => {
		if (a2uiReady && hostElement && messages) {
			hostElement.applyMessages(messages);
		}
	});
</script>

<div class="inline-a2ui-wrapper">
	<openclaw-a2ui-host bind:this={hostElement}></openclaw-a2ui-host>
</div>

<style>
	.inline-a2ui-wrapper {
		width: 100%;
		margin: 0.5rem 0;
	}
</style>
