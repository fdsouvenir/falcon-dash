<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { ensureA2UILoaded, type A2UIHostElement } from '$lib/canvas/a2ui-bridge.js';
	import { gatewayUrl } from '$lib/stores/token.js';

	interface Props {
		messages: unknown[];
	}

	let { messages = $bindable() }: Props = $props();

	let hostElement: A2UIHostElement | null = $state(null);
	let a2uiReady = $state(false);

	onMount(async () => {
		try {
			const host = window.location.hostname;
			let gwPort = 18789;
			try {
				gwPort = parseInt(new URL(get(gatewayUrl)).port, 10) || 18789;
			} catch {}
			console.log('[InlineA2UI] loading A2UI bundle, host:', host);
			await ensureA2UILoaded(host, gwPort);
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
